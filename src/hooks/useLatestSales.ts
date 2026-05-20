import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LatestSaleRow {
  id: string;
  saleNumber: string | number | null;
  itemsCount: number;
  customerName: string | null;
  paymentType: string;
  total: number;
  createdAt: string;
}

export const useLatestSales = (branchId?: string, limit = 6) =>
  useQuery<LatestSaleRow[]>({
    queryKey: ['latest-sales-easy', branchId, limit],
    enabled: !!branchId,
    queryFn: async () => {
      if (!branchId) return [];
      const { data: sales } = await supabase
        .from('sales')
        .select('id, sale_number, total, payment_type, created_at, customers(name)')
        .eq('branch_id', branchId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!sales || sales.length === 0) return [];

      const ids = sales.map((s: any) => s.id);
      const { data: items } = await supabase
        .from('sale_items')
        .select('sale_id, quantity')
        .in('sale_id', ids);

      const countMap = new Map<string, number>();
      (items || []).forEach((it: any) => {
        countMap.set(it.sale_id, (countMap.get(it.sale_id) || 0) + 1);
      });

      return sales.map((s: any) => ({
        id: s.id,
        saleNumber: s.sale_number ?? null,
        itemsCount: countMap.get(s.id) ?? 0,
        customerName: s.customers?.name ?? null,
        paymentType: s.payment_type,
        total: Number(s.total),
        createdAt: s.created_at,
      }));
    },
    refetchInterval: 30000,
  });
