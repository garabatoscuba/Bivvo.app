import { useState } from 'react';
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

interface MermaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  products: Array<{ id: string; name: string; code: string; cost_price: number }>;
  stockMap: Map<string, number>;
  /** Pre-select a product (e.g. from POS) */
  preselectedProductId?: string;
}

export const MermaDialog = ({
  open,
  onOpenChange,
  branchId,
  products,
  stockMap,
  preselectedProductId,
}: MermaDialogProps) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const [productId, setProductId] = useState(preselectedProductId || '');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [productSearch, setProductSearch] = useState('');

  const selectedProduct = products.find(p => p.id === productId);
  const maxStock = stockMap.get(productId) || 0;

  const resetForm = () => {
    setProductId(preselectedProductId || '');
    setQuantity(1);
    setReason('');
    setNotes('');
    setProductSearch('');
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!profile?.user_id || !productId || !reason) throw new Error('Datos incompletos');

      // Deduct stock
      const { data: existing } = await supabase
        .from('branch_stock')
        .select('id, quantity')
        .eq('branch_id', branchId)
        .eq('product_id', productId)
        .maybeSingle();

      if (!existing || existing.quantity < quantity) {
        throw new Error('Stock insuficiente');
      }

      await supabase
        .from('branch_stock')
        .update({ quantity: existing.quantity - quantity })
        .eq('id', existing.id);

      // Record movement
      const reasonLabel = MERMA_REASONS.find(r => r.value === reason)?.label || reason;
      const fullNotes = `Merma: ${reasonLabel}${notes ? ' — ' + notes : ''}`;

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
      toast({ title: 'Merma registrada', description: `${quantity} unidad(es) de ${selectedProduct?.name} descontadas del inventario` });
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
                  const stock = stockMap.get(p.id) || 0;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setProductId(p.id); setProductSearch(''); }}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted transition-colors text-left',
                        productId === p.id && 'bg-primary/10 font-medium'
                      )}
                    >
                      <span className="truncate">{p.name} <span className="text-muted-foreground">({p.code})</span></span>
                      <span className="text-xs text-muted-foreground ml-2 shrink-0">{stock} uds</span>
                    </button>
                  );
                })
              )}
            </div>
            {selectedProduct && (
              <p className="text-sm text-muted-foreground">
                Seleccionado: <strong>{selectedProduct.name}</strong> — Stock: {maxStock}
              </p>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label>Cantidad</Label>
            <Input
              type="number"
              min={1}
              max={maxStock}
              value={quantity}
              onChange={e => setQuantity(Math.min(Number(e.target.value), maxStock))}
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
            disabled={!productId || !reason || quantity <= 0 || quantity > maxStock || mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PackageX className="h-4 w-4 mr-2" />}
            Registrar merma
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
