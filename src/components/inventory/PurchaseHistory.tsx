import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { History, Loader2 } from 'lucide-react';

interface PurchaseHistoryProps {
  productId: string;
  isRawMaterial?: boolean;
}

export const PurchaseHistory = ({ productId, isRawMaterial }: PurchaseHistoryProps) => {
  const { data: entries, isLoading } = useQuery({
    queryKey: ['purchase-history', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_stock_entries')
        .select('id, quantity, unit_cost, resulting_avg_cost, created_at, supplier, reason')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!productId,
  });

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
              <th className="text-right px-2 py-1.5 font-medium">Cant.</th>
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
                <td className="text-right px-2 py-1.5">{entry.quantity}</td>
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
