import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { History, Loader2 } from 'lucide-react';
import { convertUnits, normalizeUnitKey, getUnitDef } from '@/lib/unitConversion';

interface PurchaseHistoryProps {
  productId: string;
  isRawMaterial?: boolean;
  /** The product's current usage unit (unit_of_measure / unit_use) */
  usageUnit?: string;
}

export const PurchaseHistory = ({ productId, isRawMaterial, usageUnit }: PurchaseHistoryProps) => {
  const { data: productEntries, isLoading: loadingProducts } = useQuery({
    queryKey: ['purchase-history-product', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_stock_entries')
        .select('id, quantity, unit_cost, resulting_avg_cost, created_at, supplier, reason, purchase_unit')
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
        .select('id, cantidad, costo_unitario, resulting_avg_cost, created_at, nota, entry_type, purchase_unit')
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
        }))
      : (productEntries || []).map((e) => ({
          id: e.id,
          quantity: e.quantity,
          unit_cost: e.unit_cost,
          resulting_avg_cost: e.resulting_avg_cost,
          created_at: e.created_at,
          purchase_unit: (e as any).purchase_unit as string | null,
        }));

    // Calculate running weighted avg for entries that don't have resulting_avg_cost
    let runningStock = 0;
    let runningCost = 0;
    for (const entry of raw) {
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
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t border-muted/30">
                <td className="px-2 py-1.5 text-muted-foreground">
                  {format(new Date(entry.created_at), 'dd MMM yy', { locale: es })}
                </td>
                <td className="text-right px-2 py-1.5 whitespace-nowrap">
                  {formatQtyWithUnit(entry.quantity, entry.purchase_unit)}
                </td>
                <td className="text-right px-2 py-1.5">
                  {entry.unit_cost != null ? `$${Number(entry.unit_cost).toFixed(2)}` : '—'}
                </td>
                <td className="text-right px-2 py-1.5 font-medium text-primary">
                  {entry.resulting_avg_cost != null ? `$${Number(entry.resulting_avg_cost).toFixed(2)}` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
