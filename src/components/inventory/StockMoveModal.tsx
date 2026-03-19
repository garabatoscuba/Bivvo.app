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
import { useResolvedBusinessId } from '@/hooks/useResolvedBusinessId';
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

type StaticLocationKey = 'sale' | 'warehouse' | 'uso_interno';
type LocationKey = StaticLocationKey | `area:${string}`;

type LocationOption = {
  key: LocationKey;
  label: string;
  stock?: number;
};

const createAreaKey = (areaId: string): LocationKey => `area:${areaId}`;
const getAreaIdFromKey = (value: LocationKey | '') =>
  typeof value === 'string' && value.startsWith('area:') ? value.slice(5) : null;

const dedupeOptions = <T extends LocationOption>(options: T[]) => {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.key)) return false;
    seen.add(option.key);
    return true;
  });
};

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
  const { businessId } = useResolvedBusinessId();
  const queryClient = useQueryClient();
  const auditLog = useAuditLog();

  const [from, setFrom] = useState<LocationKey | ''>('');
  const [to, setTo] = useState<LocationKey | ''>('');
  const [quantity, setQuantity] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resolvedBusinessId = businessId || profile?.business_id || null;
  const currentAreaId = ((product as any)?.insumo_area_id || (product as any)?.area_id || null) as string | null;

  const { data: areas } = useQuery({
    queryKey: ['insumo-areas-move', resolvedBusinessId],
    queryFn: async () => {
      const { data } = await supabase
        .from('insumo_areas')
        .select('id, name, is_internal')
        .eq('business_id', resolvedBusinessId!)
        .order('is_internal', { ascending: false })
        .order('name');
      return data || [];
    },
    enabled: !!resolvedBusinessId && open && isRawMaterial,
  });

  const currentArea = areas?.find((area) => area.id === currentAreaId) || null;
  const nonInternalAreas = (areas || []).filter((area) => !area.is_internal);
  const saleLabel = currentArea?.name || areaName || 'A la Venta';

  const fromOptions = useMemo(() => {
    const opts: LocationOption[] = [];

    if (isRawMaterial) {
      if (saleStock > 0) {
        opts.push({
          key: currentAreaId ? createAreaKey(currentAreaId) : 'sale',
          label: saleLabel,
          stock: saleStock,
        });
      }
      if (warehouseStock > 0) {
        opts.push({ key: 'warehouse', label: 'Almacén', stock: warehouseStock });
      }
      return dedupeOptions(opts);
    }

    if (saleStock > 0) opts.push({ key: 'sale', label: 'A la Venta', stock: saleStock });
    if (warehouseStock > 0) opts.push({ key: 'warehouse', label: 'Almacén', stock: warehouseStock });
    return dedupeOptions(opts);
  }, [currentAreaId, isRawMaterial, saleLabel, saleStock, warehouseStock]);

  const toOptions = useMemo(() => {
    const opts: LocationOption[] = [];

    if (isRawMaterial) {
      if (from !== 'warehouse') {
        opts.push({ key: 'warehouse', label: 'Almacén' });
      }

      nonInternalAreas.forEach((area) => {
        const key = createAreaKey(area.id);
        if (key !== from) {
          opts.push({ key, label: area.name });
        }
      });

      if (!nonInternalAreas.length && from !== 'sale') {
        opts.push({ key: 'sale', label: 'A la Venta' });
      }

      if (from !== 'uso_interno') {
        opts.push({ key: 'uso_interno', label: 'Uso Interno' });
      }

      return dedupeOptions(opts);
    }

    if (from !== 'sale') opts.push({ key: 'sale', label: 'A la Venta' });
    if (from !== 'warehouse') opts.push({ key: 'warehouse', label: 'Almacén' });

    return dedupeOptions(opts);
  }, [from, isRawMaterial, nonInternalAreas]);

  const maxQty = useMemo(() => {
    const selected = fromOptions.find((option) => option.key === from);
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

  const handleOpen = () => {
    if (fromOptions.length === 1) {
      setFrom(fromOptions[0].key);
    }
  };

  const handleSubmit = async () => {
    if (!product || !profile?.user_id || !branchId || !isValid) return;
    setSubmitting(true);

    try {
      const fromLabel = fromOptions.find((option) => option.key === from)?.label || from;
      const toLabel = toOptions.find((option) => option.key === to)?.label || to;
      const moveLabel = `Mover stock: ${fromLabel} → ${toLabel}${notes ? ` | ${notes}` : ''}`;

      if (isRawMaterial) {
        await handleRawMaterialMove(moveLabel);
      } else {
        await handleProductMove(moveLabel);
      }

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
    const fromAreaId = getAreaIdFromKey(from);
    const toAreaId = getAreaIdFromKey(to);

    const { data: mat } = await supabase
      .from('raw_materials')
      .select('id, area_id, stock_almacen, stock_vendedor')
      .eq('id', product!.id)
      .single();

    if (!mat) throw new Error('Insumo no encontrado');

    const sellerStock = Number(mat.stock_vendedor) || 0;
    const warehouseQty = Number(mat.stock_almacen) || 0;
    const currentMatAreaId = mat.area_id || null;
    const updates: Record<string, number | string | null> = {};

    if (from === 'warehouse') {
      if (warehouseQty < parsedQty) throw new Error('Stock insuficiente en almacén');
      updates.stock_almacen = warehouseQty - parsedQty;
    } else {
      if (sellerStock < parsedQty) throw new Error(`Stock insuficiente en ${saleLabel}`);
      updates.stock_vendedor = sellerStock - parsedQty;
    }

    if (to === 'uso_interno') {
      await supabase.from('raw_material_entries').insert({
        material_id: product!.id,
        cantidad: -Math.abs(parsedQty),
        costo_unitario: 0,
        nota: notes || 'Salida por uso interno',
        user_id: profile!.user_id,
        business_id: resolvedBusinessId,
        branch_id: branchId,
        entry_type: 'uso_interno',
      } as any);
    } else if (to === 'warehouse') {
      updates.stock_almacen = (Number(updates.stock_almacen ?? warehouseQty) || 0) + parsedQty;
    } else {
      if (toAreaId) {
        const movingBetweenAreas = !!fromAreaId && fromAreaId !== toAreaId;
        const partialAreaReassignment = movingBetweenAreas && parsedQty < sellerStock;
        const partialGenericSaleReassignment = from === 'sale' && sellerStock > parsedQty;
        const conflictingSaleLocation =
          from === 'warehouse' &&
          sellerStock > 0 &&
          currentMatAreaId !== toAreaId;

        if (partialAreaReassignment || partialGenericSaleReassignment) {
          throw new Error('Para mover entre áreas debes mover todo el stock disponible de esa ubicación');
        }

        if (conflictingSaleLocation) {
          throw new Error('Este insumo ya tiene stock en otra área. Muévelo primero desde esa área o vacíala antes de enviarlo a otra');
        }

        updates.stock_vendedor = (Number(updates.stock_vendedor ?? sellerStock) || 0) + parsedQty;
        updates.area_id = toAreaId;
      } else {
        updates.stock_vendedor = (Number(updates.stock_vendedor ?? sellerStock) || 0) + parsedQty;
      }
    }

    await supabase.from('raw_materials').update(updates as any).eq('id', mat.id);

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

    if (from === 'warehouse') {
      if ((existing.warehouse_quantity || 0) < parsedQty) throw new Error('Stock insuficiente en almacén');
      updates.warehouse_quantity = (existing.warehouse_quantity || 0) - parsedQty;
    } else {
      if (existing.quantity < parsedQty) throw new Error('Stock insuficiente en A la Venta');
      updates.quantity = existing.quantity - parsedQty;
    }

    if (to === 'uso_interno') {
      // No stock added, just deducted
    } else if (to === 'warehouse') {
      updates.warehouse_quantity = (updates.warehouse_quantity ?? existing.warehouse_quantity ?? 0) + parsedQty;
    } else {
      updates.quantity = (updates.quantity ?? existing.quantity) + parsedQty;
    }

    await supabase.from('branch_stock').update(updates).eq('id', existing.id);

    await supabase.from('inventory_movements').insert([
      {
        branch_id: branchId,
        product_id: product!.id,
        user_id: profile!.user_id,
        movement_type: 'transfer_out' as const,
        quantity: parsedQty,
        notes: moveLabel,
      },
      ...(to !== 'uso_interno'
        ? [{
            branch_id: branchId,
            product_id: product!.id,
            user_id: profile!.user_id,
            movement_type: 'transfer_in' as const,
            quantity: parsedQty,
            notes: moveLabel,
          }]
        : []),
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
              <Select value={to} onValueChange={(v) => setTo(v as LocationKey)}>
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