import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LatestSaleRow {
  id: string;
  kind: 'sale' | 'service';
  saleNumber: string | number | null;
  itemsCount: number;
  productName: string | null;
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

      const [salesRes, servicesRes] = await Promise.all([
        supabase
          .from('sales')
          .select('id, sale_number, total, payment_type, created_at, customers(name)')
          .eq('branch_id', branchId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(limit),
        supabase
          .from('service_entries')
          .select('id, service_name, description, amount, payment_type, created_at, customers(name)')
          .eq('branch_id', branchId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(limit),
      ]);

      const sales = salesRes.data || [];
      const services = servicesRes.data || [];

      let itemsBySale = new Map<string, { name: string | null; qty: number; count: number }>();
      if (sales.length > 0) {
        const ids = sales.map((s: any) => s.id);
        const { data: items } = await supabase
          .from('sale_items')
          .select('sale_id, quantity, products(name)')
          .in('sale_id', ids);

        (items || []).forEach((it: any) => {
          const prev = itemsBySale.get(it.sale_id) || { name: null, qty: 0, count: 0 };
          prev.qty += Number(it.quantity || 0);
          prev.count += 1;
          if (!prev.name && it.products?.name) prev.name = it.products.name;
          itemsBySale.set(it.sale_id, prev);
        });
      }

      const saleRows: LatestSaleRow[] = sales.map((s: any) => {
        const info = itemsBySale.get(s.id);
        return {
          id: s.id,
          kind: 'sale',
          saleNumber: s.sale_number ?? null,
          itemsCount: info?.qty ?? 0,
          productName: info?.name ?? null,
          customerName: s.customers?.name ?? null,
          paymentType: s.payment_type,
          total: Number(s.total),
          createdAt: s.created_at,
        };
      });

      const serviceRows: LatestSaleRow[] = services.map((s: any) => ({
        id: s.id,
        kind: 'service',
        saleNumber: null,
        itemsCount: 1,
        productName: s.service_name || s.description || 'Servicio',
        customerName: s.customers?.name ?? null,
        paymentType: s.payment_type,
        total: Number(s.amount),
        createdAt: s.created_at,
      }));

      return [...saleRows, ...serviceRows]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit);
    },
    refetchInterval: 30000,
  });
