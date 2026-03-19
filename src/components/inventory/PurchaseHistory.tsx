import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { History, Loader2, Ban } from 'lucide-react';
import { convertUnits, normalizeUnitKey, getUnitDef } from '@/lib/unitConversion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAuditLog } from '@/hooks/useAuditLog';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface PurchaseHistoryProps {
  productId: string;
  isRawMaterial?: boolean;
  /** The product's current usage unit (unit_of_measure / unit_use) */
  usageUnit?: string;
}

export const PurchaseHistory = ({ productId, isRawMaterial, usageUnit }: PurchaseHistoryProps) => {
  const queryClient = useQueryClient();
  const auditLog = useAuditLog();
  const { profile, roles } = useAuth();
  const canVoid = roles.includes('owner') || roles.includes('super_admin') || roles.includes('manager');

  const [voidTarget, setVoidTarget] = useState<{ id: string; quantity: number; unit_cost: number | null } | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);

  const { data: productEntries, isLoading: loadingProducts } = useQuery({
    queryKey: ['purchase-history-product', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_stock_entries')
        .select('id, quantity, unit_cost, resulting_avg_cost, created_at, supplier, reason, purchase_unit, is_voided, voided_at, void_reason')
        .eq('product_id', productId)
        .order('created_at', { ascending: true })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!productId && !isRawMaterial,
  });

  const { data: rawEntries, isLoading: loadingRaw } = useQuery({
    queryKey: ['purchase-history-raw', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raw_material_entries')
        .select('id, cantidad, costo_unitario, resulting_avg_cost, created_at, nota, entry_type, purchase_unit, is_voided, voided_at, void_reason')
        .eq('material_id', productId)
        .gt('cantidad', 0)
        .order('created_at', { ascending: true })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!productId && !!isRawMaterial,
  });

  const isLoading = loadingProducts || loadingRaw;

  // Normalize + compute running avg for entries missing resulting_avg_cost
  const entries = useMemo(() => {
    const raw = isRawMaterial
      ? (rawEntries || []).map((e) => ({
          id: e.id,
          quantity: e.cantidad,
          unit_cost: e.costo_unitario,
          resulting_avg_cost: e.resulting_avg_cost,
          created_at: e.created_at,
          purchase_unit: (e as any).purchase_unit as string | null,
          is_voided: !!(e as any).is_voided,
          void_reason: (e as any).void_reason as string | null,
        }))
      : (productEntries || []).map((e) => ({
          id: e.id,
          quantity: e.quantity,
          unit_cost: e.unit_cost,
          resulting_avg_cost: e.resulting_avg_cost,
          created_at: e.created_at,
          purchase_unit: (e as any).purchase_unit as string | null,
          is_voided: !!(e as any).is_voided,
          void_reason: (e as any).void_reason as string | null,
        }));

    // Calculate running weighted avg for entries that don't have resulting_avg_cost
    let runningStock = 0;
    let runningCost = 0;
    for (const entry of raw) {
      if (entry.is_voided) continue;
      const qty = entry.quantity || 0;
      const cost = entry.unit_cost ?? 0;
      if (qty > 0) {
        runningCost = (runningStock * runningCost + qty * cost) / (runningStock + qty);
        runningStock += qty;
      }
      if (entry.resulting_avg_cost == null) {
        entry.resulting_avg_cost = runningStock > 0 ? Math.round(runningCost * 10000) / 10000 : null;
      }
    }

    // Reverse to show newest first
    return raw.reverse();
  }, [isRawMaterial, rawEntries, productEntries]);

  const handleVoid = async () => {
    if (!voidTarget || !voidReason.trim() || !profile?.user_id) return;
    setVoiding(true);
    try {
      const table = isRawMaterial ? 'raw_material_entries' : 'product_stock_entries';
      const actionType = isRawMaterial ? 'anulacion_entrada_insumo' : 'anulacion_compra';
      const entityType = isRawMaterial ? 'raw_material_entry' : 'product_entry';

      // Mark entry as voided
      await supabase
        .from(table as any)
        .update({ is_voided: true, voided_at: new Date().toISOString(), void_reason: voidReason.trim() } as any)
        .eq('id', voidTarget.id);

      // Revert stock
      if (isRawMaterial) {
        // Subtract from raw_materials stock
        const { data: mat } = await supabase
          .from('raw_materials')
          .select('stock_vendedor, stock_almacen')
          .eq('id', productId)
          .single();
        if (mat) {
          // Best effort: subtract from vendedor first, then almacen
          let remaining = voidTarget.quantity;
          let newVendedor = mat.stock_vendedor || 0;
          let newAlmacen = mat.stock_almacen || 0;
          const fromVendedor = Math.min(remaining, newVendedor);
          newVendedor -= fromVendedor;
          remaining -= fromVendedor;
          if (remaining > 0) {
            newAlmacen = Math.max(0, newAlmacen - remaining);
          }
          await supabase
            .from('raw_materials')
            .update({ stock_vendedor: newVendedor, stock_almacen: newAlmacen })
            .eq('id', productId);
        }
      } else {
        // Subtract from branch_stock (quantity first, then warehouse)
        const { data: stocks } = await supabase
          .from('branch_stock')
          .select('id, quantity, warehouse_quantity')
          .eq('product_id', productId);
        if (stocks?.length) {
          let remaining = voidTarget.quantity;
          for (const s of stocks) {
            if (remaining <= 0) break;
            const fromQty = Math.min(remaining, s.quantity);
            const fromWh = Math.min(remaining - fromQty, s.warehouse_quantity || 0);
            await supabase
              .from('branch_stock')
              .update({
                quantity: s.quantity - fromQty,
                warehouse_quantity: (s.warehouse_quantity || 0) - fromWh,
              })
              .eq('id', s.id);
            remaining -= (fromQty + fromWh);
          }
        }
      }

      // Recalculate average cost from non-voided entries
      if (isRawMaterial) {
        const { data: validEntries } = await supabase
          .from('raw_material_entries')
          .select('cantidad, costo_unitario')
          .eq('material_id', productId)
          .eq('is_voided', false)
          .gt('cantidad', 0);
        let totalQty = 0, totalCost = 0;
        (validEntries || []).forEach((e: any) => {
          totalQty += e.cantidad;
          totalCost += e.cantidad * (e.costo_unitario || 0);
        });
        const newAvg = totalQty > 0 ? Math.round((totalCost / totalQty) * 10000) / 10000 : 0;
        await supabase.from('raw_materials').update({ costo_unitario: newAvg }).eq('id', productId);
      } else {
        const { data: validEntries } = await supabase
          .from('product_stock_entries')
          .select('quantity, unit_cost')
          .eq('product_id', productId)
          .eq('is_voided', false);
        let totalQty = 0, totalCost = 0;
        (validEntries || []).forEach((e: any) => {
          totalQty += e.quantity;
          totalCost += e.quantity * (e.unit_cost || 0);
        });
        const newAvg = totalQty > 0 ? Math.round((totalCost / totalQty) * 10000) / 10000 : 0;
        await supabase.from('products').update({ cost_price: newAvg }).eq('id', productId);
      }

      // Audit log
      auditLog(
        actionType as any,
        `Anulación de ${isRawMaterial ? 'entrada de insumo' : 'compra'}: ${voidReason.trim()}`,
        voidTarget.id,
        entityType
      );

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['purchase-history-product', productId] });
      queryClient.invalidateQueries({ queryKey: ['purchase-history-raw', productId] });
      queryClient.invalidateQueries({ queryKey: ['branch-stock'] });
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });

      toast({ title: 'Entrada anulada correctamente' });
      setVoidTarget(null);
      setVoidReason('');
    } catch (err: any) {
      toast({ title: 'Error al anular', description: err.message, variant: 'destructive' });
    } finally {
      setVoiding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando historial...
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-2">
        Sin historial de compras registrado.
      </div>
    );
  }

  const normalizedUsage = usageUnit ? normalizeUnitKey(usageUnit) : null;

  const formatQtyWithUnit = (qty: number, purchaseUnit: string | null) => {
    const pu = purchaseUnit || usageUnit || 'Pieza';
    const normalizedPu = normalizeUnitKey(pu);
    const puDef = getUnitDef(pu);
    const puLabel = puDef?.label || pu;

    // Check if conversion is needed
    if (normalizedUsage && normalizedPu !== normalizedUsage) {
      const converted = convertUnits(qty, pu, usageUnit!);
      if (converted !== null && converted !== qty) {
        const usageDef = getUnitDef(usageUnit!);
        const usageLabel = usageDef?.label || usageUnit!;
        return `${qty} ${puLabel} (${converted.toFixed(2)} ${usageLabel})`;
      }
    }

    return `${qty} ${puLabel}`;
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
        <History className="h-3.5 w-3.5" />
        Historial de compras
      </p>
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-2 py-1.5 font-medium">Fecha</th>
              <th className="text-right px-2 py-1.5 font-medium">Cantidad</th>
              <th className="text-right px-2 py-1.5 font-medium">Costo</th>
              <th className="text-right px-2 py-1.5 font-medium">Promedio</th>
              {canVoid && <th className="px-1 py-1.5 w-8"></th>}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className={cn(
                'border-t border-muted/30',
                entry.is_voided && 'opacity-50'
              )}>
                <td className={cn('px-2 py-1.5 text-muted-foreground', entry.is_voided && 'line-through')}>
                  {format(new Date(entry.created_at), 'dd MMM yy', { locale: es })}
                </td>
                <td className={cn('text-right px-2 py-1.5 whitespace-nowrap', entry.is_voided && 'line-through')}>
                  {entry.is_voided ? (
                    <span className="flex items-center justify-end gap-1">
                      <Badge variant="destructive" className="text-[9px] px-1 py-0">Anulado</Badge>
                      {formatQtyWithUnit(entry.quantity, entry.purchase_unit)}
                    </span>
                  ) : (
                    formatQtyWithUnit(entry.quantity, entry.purchase_unit)
                  )}
                </td>
                <td className={cn('text-right px-2 py-1.5', entry.is_voided && 'line-through')}>
                  {entry.unit_cost != null ? `$${Number(entry.unit_cost).toFixed(2)}` : '—'}
                </td>
                <td className={cn('text-right px-2 py-1.5 font-medium text-primary', entry.is_voided && 'line-through')}>
                  {entry.is_voided ? '—' : (entry.resulting_avg_cost != null ? `$${Number(entry.resulting_avg_cost).toFixed(2)}` : '—')}
                </td>
                {canVoid && (
                  <td className="px-1 py-1.5 text-center">
                    {!entry.is_voided && (
                      <button
                        onClick={() => setVoidTarget({ id: entry.id, quantity: entry.quantity, unit_cost: entry.unit_cost })}
                        className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                        title="Anular entrada"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Void confirmation dialog */}
      <AlertDialog open={!!voidTarget} onOpenChange={(open) => { if (!open && !voiding) { setVoidTarget(null); setVoidReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anular entrada</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción revertirá el stock y recalculará el costo promedio. Escribe el motivo de la anulación.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motivo de la anulación (obligatorio)"
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            rows={3}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={voiding}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={(e) => { e.preventDefault(); handleVoid(); }}
              disabled={!voidReason.trim() || voiding}
            >
              {voiding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar anulación
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
