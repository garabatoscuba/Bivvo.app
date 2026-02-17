import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  startOfDay, endOfDay, subDays, startOfMonth, endOfMonth,
  subMonths, startOfYear, endOfYear, subYears, format,
  eachHourOfInterval, eachDayOfInterval, eachMonthOfInterval,
} from 'date-fns';
import { es } from 'date-fns/locale';

export type Period = 'today' | 'week' | 'month' | 'year';

interface DateRange {
  start: Date;
  end: Date;
}

function getDateRanges(period: Period): { current: DateRange; previous: DateRange } {
  const now = new Date();
  switch (period) {
    case 'today':
      return {
        current: { start: startOfDay(now), end: endOfDay(now) },
        previous: { start: startOfDay(subDays(now, 1)), end: endOfDay(subDays(now, 1)) },
      };
    case 'week':
      return {
        current: { start: startOfDay(subDays(now, 6)), end: endOfDay(now) },
        previous: { start: startOfDay(subDays(now, 13)), end: endOfDay(subDays(now, 7)) },
      };
    case 'month':
      return {
        current: { start: startOfMonth(now), end: endOfMonth(now) },
        previous: { start: startOfMonth(subMonths(now, 1)), end: endOfMonth(subMonths(now, 1)) },
      };
    case 'year':
      return {
        current: { start: startOfYear(now), end: endOfYear(now) },
        previous: { start: startOfYear(subYears(now, 1)), end: endOfYear(subYears(now, 1)) },
      };
  }
}

function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export interface DashboardStats {
  totalSales: number;
  totalSalesChange: number;
  salesCount: number;
  salesCountChange: number;
  avgTicket: number;
  avgTicketChange: number;
  pendingCredit: number;
  salesOverTime: { label: string; total: number }[];
  paymentMethods: { name: string; value: number; fill: string }[];
  topProducts: { name: string; quantity: number }[];
}

const PAYMENT_COLORS: Record<string, string> = {
  cash: 'hsl(142, 50%, 42%)',
  card: 'hsl(199, 55%, 62%)',
  transfer: 'hsl(270, 40%, 66%)',
  credit: 'hsl(38, 70%, 48%)',
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  credit: 'Crédito',
};

function buildTimeLabels(period: Period, range: DateRange): string[] {
  switch (period) {
    case 'today':
      return eachHourOfInterval(range).map(d => format(d, 'HH:00'));
    case 'week':
      return eachDayOfInterval(range).map(d => format(d, 'EEE dd', { locale: es }));
    case 'month':
      return eachDayOfInterval(range).map(d => format(d, 'dd'));
    case 'year':
      return eachMonthOfInterval(range).map(d => format(d, 'MMM', { locale: es }));
  }
}

function bucketKey(date: Date, period: Period): string {
  switch (period) {
    case 'today': return format(date, 'HH:00');
    case 'week': return format(date, 'EEE dd', { locale: es });
    case 'month': return format(date, 'dd');
    case 'year': return format(date, 'MMM', { locale: es });
  }
}

export const useDashboardStats = (branchId?: string, period: Period = 'today') => {
  const { profile } = useAuth();
  const ranges = getDateRanges(period);

  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', branchId, period],
    queryFn: async () => {
      if (!branchId) throw new Error('No branch');

      // Fetch current + previous sales, and pending credit in parallel
      const [currentRes, previousRes, pendingRes, saleItemsRes] = await Promise.all([
        supabase
          .from('sales')
          .select('id, total, payment_type, created_at, status')
          .eq('branch_id', branchId)
          .eq('status', 'completed')
          .gte('created_at', ranges.current.start.toISOString())
          .lte('created_at', ranges.current.end.toISOString()),
        supabase
          .from('sales')
          .select('total')
          .eq('branch_id', branchId)
          .eq('status', 'completed')
          .gte('created_at', ranges.previous.start.toISOString())
          .lte('created_at', ranges.previous.end.toISOString()),
        supabase
          .from('sales')
          .select('total, amount_paid')
          .eq('branch_id', branchId)
          .eq('status', 'pending'),
        supabase
          .from('sale_items')
          .select('product_id, quantity, sale_id, sale:sales!inner(branch_id, status, created_at)')
          .eq('sale.branch_id', branchId)
          .eq('sale.status', 'completed')
          .gte('sale.created_at', ranges.current.start.toISOString())
          .lte('sale.created_at', ranges.current.end.toISOString()),
      ]);

      const currentSales = currentRes.data || [];
      const previousSales = previousRes.data || [];
      const pendingSales = pendingRes.data || [];
      const saleItems = saleItemsRes.data || [];

      // KPIs
      const totalSales = currentSales.reduce((s, v) => s + Number(v.total), 0);
      const prevTotal = previousSales.reduce((s, v) => s + Number(v.total), 0);
      const salesCount = currentSales.length;
      const prevCount = previousSales.length;
      const avgTicket = salesCount > 0 ? totalSales / salesCount : 0;
      const prevAvg = prevCount > 0 ? prevTotal / prevCount : 0;
      const pendingCredit = pendingSales.reduce((s, v) => s + (Number(v.total) - Number(v.amount_paid)), 0);

      // Sales over time
      const labels = buildTimeLabels(period, ranges.current);
      const buckets: Record<string, number> = {};
      labels.forEach(l => (buckets[l] = 0));
      currentSales.forEach(s => {
        const key = bucketKey(new Date(s.created_at), period);
        if (key in buckets) buckets[key] += Number(s.total);
      });
      const salesOverTime = labels.map(label => ({ label, total: buckets[label] || 0 }));

      // Payment methods
      const pmTotals: Record<string, number> = {};
      currentSales.forEach(s => {
        pmTotals[s.payment_type] = (pmTotals[s.payment_type] || 0) + Number(s.total);
      });
      const paymentMethods = Object.entries(pmTotals).map(([key, value]) => ({
        name: PAYMENT_LABELS[key] || key,
        value,
        fill: PAYMENT_COLORS[key] || 'hsl(215, 20%, 65%)',
      }));

      // Top 5 products
      const productTotals: Record<string, number> = {};
      const productIds = [...new Set(saleItems.map(si => si.product_id))];
      
      // Fetch product names
      let productMap: Record<string, string> = {};
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from('products')
          .select('id, name')
          .in('id', productIds);
        (products || []).forEach(p => (productMap[p.id] = p.name));
      }
      
      saleItems.forEach(si => {
        const name = productMap[si.product_id] || 'Desconocido';
        productTotals[name] = (productTotals[name] || 0) + si.quantity;
      });
      const topProducts = Object.entries(productTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, quantity]) => ({ name, quantity }));

      return {
        totalSales,
        totalSalesChange: calcChange(totalSales, prevTotal),
        salesCount,
        salesCountChange: calcChange(salesCount, prevCount),
        avgTicket,
        avgTicketChange: calcChange(avgTicket, prevAvg),
        pendingCredit,
        salesOverTime,
        paymentMethods,
        topProducts,
      };
    },
    enabled: !!branchId && !!profile?.business_id,
    refetchInterval: period === 'today' ? 30000 : undefined,
  });
};
