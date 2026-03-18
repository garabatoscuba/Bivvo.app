import { useState, useMemo } from 'react';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, PackageX, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const MERMA_REASONS = [
  { value: 'vencimiento', label: 'Vencimiento' },
  { value: 'dano', label: 'Daño' },
  { value: 'robo', label: 'Robo' },
  { value: 'uso_interno', label: 'Uso interno' },
  { value: 'otro', label: 'Otro' },
] as const;

type DeductSource = 'sale' | 'warehouse' | 'area';

interface MermaProduct {
  id: string;
  name: string;
  code: string;
  cost_price: number;
  unit_of_measure?: string;
  _isRawMaterial?: boolean;
}

interface StockBreakdown {
  sale: number;
  warehouse: number;
  area: number; // only for raw materials (stock_vendedor)
}

interface MermaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  products: MermaProduct[];
  /** Per-product stock breakdown: { sale, warehouse, area } */
  stockBreakdownMap: Map<string, StockBreakdown>;
  /** Legacy total stockMap for backwards compat */
  stockMap?: Map<string, number>;
  /** If true, user can only deduct from "A la Venta" */
  sellerOnly?: boolean;
  preselectedProductId?: string;
}

export const MermaDialog = ({
  open,
  onOpenChange,
  branchId,
  products,
  stockBreakdownMap,
  stockMap,
  sellerOnly = false,
  preselectedProductId,
}: MermaDialogProps) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const auditLog = useAuditLog();

  const [productId, setProductId] = useState(preselectedProductId || '');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [deductSource, setDeductSource] = useState<DeductSource>('sale');

  const selectedProduct = products.find(p => p.id === productId);
  const breakdown = stockBreakdownMap.get(productId) || { sale: 0, warehouse: 0, area: 0 };
  const unitLabel = selectedProduct?.unit_of_measure || 'uds';

  // Determine available sources for the selected product
  const availableSources = useMemo(() => {
    if (!selectedProduct) return [];
    const isRaw = selectedProduct._isRawMaterial === true;
    const sources: { value: DeductSource; label: string; stock: number }[] = [];

    if (isRaw) {
      // Raw materials: "Área" (stock_vendedor) and "Almacén" (stock_almacen)
      sources.push({ value: 'area', label: 'Área (uso)', stock: breakdown.area });
      if (!sellerOnly) {
        sources.push({ value: 'warehouse', label: 'Almacén', stock: breakdown.warehouse });
      }
    } else {
      // Regular products: "A la Venta" and "Almacén"
      sources.push({ value: 'sale', label: 'A la Venta', stock: breakdown.sale });
      if (!sellerOnly) {
        sources.push({ value: 'warehouse', label: 'Almacén', stock: breakdown.warehouse });
      }
    }

    return sources.filter(s => s.stock > 0 || s.value === (isRaw ? 'area' : 'sale'));
  }, [selectedProduct, breakdown, sellerOnly]);

  const maxStock = useMemo(() => {
    if (deductSource === 'sale') return breakdown.sale;
    if (deductSource === 'warehouse') return breakdown.warehouse;
    if (deductSource === 'area') return breakdown.area;
    return 0;
  }, [deductSource, breakdown]);

  const totalStock = breakdown.sale + breakdown.warehouse + breakdown.area;

  const resetForm = () => {
    setProductId(preselectedProductId || '');
    setQuantity(1);
    setReason('');
    setNotes('');
    setProductSearch('');
    setDeductSource('sale');
  };

  // Auto-select first valid source when product changes
  const handleSelectProduct = (id: string) => {
    setProductId(id);
    setProductSearch('');
    const prod = products.find(p => p.id === id);
    const isRaw = prod?._isRawMaterial === true;
    setDeductSource(isRaw ? 'area' : 'sale');
    setQuantity(1);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!profile?.user_id || !productId || !reason) throw new Error('Datos incompletos');
      if (quantity <= 0 || quantity > maxStock) throw new Error('Cantidad inválida');

      const isRawMaterial = selectedProduct?._isRawMaterial === true;

      if (isRawMaterial) {
        const { data: mat } = await supabase
          .from('raw_materials')
          .select('id, stock_vendedor, stock_almacen')
          .eq('id', productId)
          .maybeSingle();

        if (!mat) throw new Error('Insumo no encontrado');

        if (deductSource === 'area') {
          if ((mat.stock_vendedor || 0) < quantity) throw new Error('Stock insuficiente en área');
          await supabase
            .from('raw_materials')
            .update({ stock_vendedor: (mat.stock_vendedor || 0) - quantity })
            .eq('id', productId);
        } else {
          if ((mat.stock_almacen || 0) < quantity) throw new Error('Stock insuficiente en almacén');
          await supabase
            .from('raw_materials')
            .update({ stock_almacen: (mat.stock_almacen || 0) - quantity })
            .eq('id', productId);
        }
      } else {
        const { data: existing } = await supabase
          .from('branch_stock')
          .select('id, quantity, warehouse_quantity')
          .eq('branch_id', branchId)
          .eq('product_id', productId)
          .maybeSingle();

        if (!existing) throw new Error('Stock no encontrado');

        if (deductSource === 'sale') {
          if ((existing.quantity || 0) < quantity) throw new Error('Stock insuficiente en venta');
          await supabase
            .from('branch_stock')
            .update({ quantity: (existing.quantity || 0) - quantity })
            .eq('id', existing.id);
        } else {
          if ((existing.warehouse_quantity || 0) < quantity) throw new Error('Stock insuficiente en almacén');
          await supabase
            .from('branch_stock')
            .update({ warehouse_quantity: (existing.warehouse_quantity || 0) - quantity })
            .eq('id', existing.id);
        }
      }

      // Record movement
      const reasonLabel = MERMA_REASONS.find(r => r.value === reason)?.label || reason;
      const sourceLabel = deductSource === 'sale' ? 'venta' : deductSource === 'warehouse' ? 'almacén' : 'área';
      const fullNotes = `Merma (${sourceLabel}): ${reasonLabel}${notes ? ' — ' + notes : ''}`;

      await supabase.from('inventory_movements').insert({
        branch_id: branchId,
        product_id: productId,
        user_id: profile.user_id,
        movement_type: 'loss' as const,
        quantity,
        notes: fullNotes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      queryClient.invalidateQueries({ queryKey: ['raw-materials-for-products'] });
      toast({ title: 'Merma registrada', description: `${quantity} unidad(es) de ${selectedProduct?.name} descontadas` });
      const reasonLabel = MERMA_REASONS.find(r => r.value === reason)?.label || reason;
      auditLog(
        'shrinkage_registered',
        `Merma de ${quantity} unidades de ${selectedProduct?.name} — motivo: ${reasonLabel}`,
        productId,
        'product'
      );
      resetForm();
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: 'Error al registrar merma', description: err.message, variant: 'destructive' });
    },
  });

  const filteredProducts = products.filter(p =>
    !productSearch ||
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.code.toLowerCase().includes(productSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageX className="h-5 w-5 text-destructive" />
            Registrar Merma
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Product selector */}
          <div className="space-y-2">
            <Label>Producto</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar producto..."
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="max-h-32 overflow-y-auto border rounded-md">
              {filteredProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-3">Sin resultados</p>
              ) : (
                filteredProducts.map(p => {
                  const bd = stockBreakdownMap.get(p.id) || { sale: 0, warehouse: 0, area: 0 };
                  const total = bd.sale + bd.warehouse + bd.area;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSelectProduct(p.id)}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors text-left',
                        productId === p.id && 'bg-primary/10 font-medium'
                      )}
                    >
                      <span className="truncate">{p.name} {p.code && <span className="text-muted-foreground">({p.code})</span>}</span>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">{total} uds</span>
                    </button>
                  );
                })
              )}
            </div>
            {selectedProduct && (
              <p className="text-sm text-muted-foreground">
                Seleccionado: <strong>{selectedProduct.name}</strong> — Total: {totalStock} uds
              </p>
            )}
          </div>

          {/* Deduct source */}
          {selectedProduct && availableSources.length > 0 && (
            <div className="space-y-2">
              <Label>Descontar de</Label>
              <Select value={deductSource} onValueChange={(v) => { setDeductSource(v as DeductSource); setQuantity(1); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableSources.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label} ({s.stock} uds)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-2">
            <Label>Cantidad {maxStock > 0 && <span className="text-muted-foreground font-normal">(máx. {maxStock})</span>}</Label>
            <Input
              type="number"
              min={1}
              max={maxStock}
              value={quantity}
              onChange={e => setQuantity(Math.min(Math.max(1, Number(e.target.value)), maxStock))}
            />
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar motivo" />
              </SelectTrigger>
              <SelectContent>
                {MERMA_REASONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Observaciones (opcional)</Label>
            <Textarea
              placeholder="Detalles adicionales..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={!productId || !reason || quantity <= 0 || quantity > maxStock || maxStock <= 0 || mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PackageX className="h-4 w-4 mr-2" />}
            Registrar merma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
