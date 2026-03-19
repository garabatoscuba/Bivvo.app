import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ArrowRightLeft, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import type { Product } from '@/types/database';

interface StockMoveModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
  /** Stock in sale/area (branch_stock.quantity or raw_materials.stock_vendedor) */
  saleStock: number;
  /** Stock in warehouse (branch_stock.warehouse_quantity or raw_materials.stock_almacen) */
  warehouseStock: number;
  branchId: string;
  /** Whether this is a raw material */
  isRawMaterial?: boolean;
  /** Area name for display (e.g. "Cocina") — only for ingrediente/raw material */
  areaName?: string;
}

type LocationKey = 'sale' | 'warehouse';

export const StockMoveModal = ({
  open,
  onOpenChange,
  product,
  saleStock,
  warehouseStock,
  branchId,
  isRawMaterial = false,
  areaName,
}: StockMoveModalProps) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const auditLog = useAuditLog();

  const [from, setFrom] = useState<LocationKey | ''>('');
  const [to, setTo] = useState<LocationKey | 'uso_interno' | ''>('');
  const [quantity, setQuantity] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isIngredient = (product as any)?.tipo === 'ingrediente';
  const saleLabel = isIngredient ? (areaName || 'Área') : 'Venta';

  // Build available locations based on stock
  const fromOptions = useMemo(() => {
    const opts: { key: LocationKey; label: string; stock: number }[] = [];
    if (saleStock > 0) opts.push({ key: 'sale', label: saleLabel, stock: saleStock });
    if (warehouseStock > 0) opts.push({ key: 'warehouse', label: 'Almacén', stock: warehouseStock });
    return opts;
  }, [saleStock, warehouseStock, saleLabel]);

  const toOptions = useMemo(() => {
    const opts: { key: LocationKey | 'uso_interno'; label: string }[] = [];
    if (from !== 'sale') opts.push({ key: 'sale', label: saleLabel });
    if (from !== 'warehouse') opts.push({ key: 'warehouse', label: 'Almacén' });
    // Always show Uso Interno as destination
    opts.push({ key: 'uso_interno', label: 'Uso Interno' });
    return opts;
  }, [from, saleLabel]);

  const maxQty = useMemo(() => {
    const selected = fromOptions.find(o => o.key === from);
    return selected?.stock || 0;
  }, [from, fromOptions]);

  const parsedQty = parseFloat(quantity) || 0;
  const isValid = from && to && parsedQty > 0 && parsedQty <= maxQty;

  const resetForm = () => {
    setFrom('');
    setTo('');
    setQuantity('');
    setNotes('');
  };

  const handleClose = (value: boolean) => {
    if (!value) resetForm();
    onOpenChange(value);
  };

  // Auto-select when only one from option
  const handleOpen = () => {
    if (fromOptions.length === 1) {
      setFrom(fromOptions[0].key);
    }
  };

  const handleSubmit = async () => {
    if (!product || !profile?.user_id || !branchId || !isValid) return;
    setSubmitting(true);

    try {
      const fromLabel = fromOptions.find(o => o.key === from)?.label || from;
      const toLabel = toOptions.find(o => o.key === to)?.label || to;
      const moveLabel = `Mover stock: ${fromLabel} → ${toLabel}${notes ? ` | ${notes}` : ''}`;

      if (isRawMaterial) {
        await handleRawMaterialMove(moveLabel);
      } else {
        await handleProductMove(moveLabel);
      }

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      queryClient.invalidateQueries({ queryKey: ['raw-materials-for-products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-movements'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });

      auditLog(
        'stock_transfer',
        `Movimiento de ${parsedQty} unidades de ${product.name}: ${fromLabel} → ${toLabel}`,
        product.id,
        isRawMaterial ? 'raw_material' : 'product'
      );

      toast({ title: `${parsedQty} unidades movidas: ${fromLabel} → ${toLabel}` });
      handleClose(false);
    } catch (err: any) {
      toast({ title: 'Error al mover stock', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRawMaterialMove = async (moveLabel: string) => {
    const { data: mat } = await supabase
      .from('raw_materials')
      .select('id, stock_almacen, stock_vendedor')
      .eq('id', product!.id)
      .single();

    if (!mat) throw new Error('Insumo no encontrado');

    const updates: any = {};

    // Deduct from source
    if (from === 'warehouse') {
      if ((mat.stock_almacen || 0) < parsedQty) throw new Error('Stock insuficiente en almacén');
      updates.stock_almacen = (mat.stock_almacen || 0) - parsedQty;
    } else {
      if ((mat.stock_vendedor || 0) < parsedQty) throw new Error(`Stock insuficiente en ${saleLabel}`);
      updates.stock_vendedor = (mat.stock_vendedor || 0) - parsedQty;
    }

    // Add to destination (unless uso_interno)
    if (to === 'uso_interno') {
      // Register as uso_interno in raw_material_entries
      await supabase.from('raw_material_entries').insert({
        material_id: product!.id,
        cantidad: -Math.abs(parsedQty),
        costo_unitario: 0,
        nota: notes || 'Salida por uso interno',
        user_id: profile!.user_id,
        business_id: profile!.business_id,
        branch_id: branchId,
        entry_type: 'uso_interno',
      } as any);
    } else if (to === 'warehouse') {
      updates.stock_almacen = (updates.stock_almacen ?? mat.stock_almacen ?? 0) + parsedQty;
    } else {
      updates.stock_vendedor = (updates.stock_vendedor ?? mat.stock_vendedor ?? 0) + parsedQty;
    }

    await supabase.from('raw_materials').update(updates).eq('id', mat.id);

    // Register inventory movement
    await supabase.from('inventory_movements').insert({
      branch_id: branchId,
      product_id: product!.id,
      user_id: profile!.user_id,
      movement_type: to === 'uso_interno' ? 'transfer_out' as const : 'transfer_in' as const,
      quantity: parsedQty,
      notes: moveLabel,
    });
  };

  const handleProductMove = async (moveLabel: string) => {
    const { data: existing } = await supabase
      .from('branch_stock')
      .select('id, quantity, warehouse_quantity')
      .eq('branch_id', branchId)
      .eq('product_id', product!.id)
      .maybeSingle();

    if (!existing) throw new Error('Registro de stock no encontrado');

    const updates: any = {};

    // Deduct from source
    if (from === 'warehouse') {
      if ((existing.warehouse_quantity || 0) < parsedQty) throw new Error('Stock insuficiente en almacén');
      updates.warehouse_quantity = (existing.warehouse_quantity || 0) - parsedQty;
    } else {
      if (existing.quantity < parsedQty) throw new Error(`Stock insuficiente en ${saleLabel}`);
      updates.quantity = existing.quantity - parsedQty;
    }

    // Add to destination (unless uso_interno)
    if (to === 'uso_interno') {
      // No stock added, just deducted
    } else if (to === 'warehouse') {
      updates.warehouse_quantity = (updates.warehouse_quantity ?? existing.warehouse_quantity ?? 0) + parsedQty;
    } else {
      updates.quantity = (updates.quantity ?? existing.quantity) + parsedQty;
    }

    await supabase.from('branch_stock').update(updates).eq('id', existing.id);

    // Register inventory movements
    await supabase.from('inventory_movements').insert([
      {
        branch_id: branchId,
        product_id: product!.id,
        user_id: profile!.user_id,
        movement_type: 'transfer_out' as const,
        quantity: parsedQty,
        notes: moveLabel,
      },
      ...(to !== 'uso_interno' ? [{
        branch_id: branchId,
        product_id: product!.id,
        user_id: profile!.user_id,
        movement_type: 'transfer_in' as const,
        quantity: parsedQty,
        notes: moveLabel,
      }] : []),
    ]);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={() => handleOpen()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Mover stock
          </DialogTitle>
          {product && (
            <p className="text-sm text-muted-foreground">{product.name}</p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* From */}
          <div className="space-y-1.5">
            <Label>De (origen)</Label>
            <Select value={from} onValueChange={(v) => { setFrom(v as LocationKey); setTo(''); setQuantity(''); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona origen" />
              </SelectTrigger>
              <SelectContent>
                {fromOptions.map(o => (
                  <SelectItem key={o.key} value={o.key}>
                    {o.label} ({o.stock} disponibles)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* To */}
          {from && (
            <div className="space-y-1.5">
              <Label>A (destino)</Label>
              <Select value={to} onValueChange={(v) => setTo(v as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona destino" />
                </SelectTrigger>
                <SelectContent>
                  {toOptions.map(o => (
                    <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Quantity */}
          {from && to && (
            <div className="space-y-1.5">
              <Label>Cantidad</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={0.01}
                  max={maxQty}
                  step="0.01"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="flex-1"
                />
                <span className="text-sm text-muted-foreground">/ {maxQty}</span>
              </div>
              {parsedQty > maxQty && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Cantidad excede el stock disponible
                </p>
              )}
              {to === 'uso_interno' && (
                <p className="text-xs text-muted-foreground">
                  El stock se descontará sin sumarse a otra ubicación
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          {from && to && (
            <div className="space-y-1.5">
              <Label>Motivo (opcional)</Label>
              <Textarea
                placeholder="Ej: Consumo interno, reorganización..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !isValid}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Mover {parsedQty > 0 ? parsedQty : ''} unidad{parsedQty !== 1 ? 'es' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
