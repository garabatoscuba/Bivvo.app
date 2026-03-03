import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { type Period, getDateRange, getPreviousDateRange, isInRange } from '@/lib/periodUtils';
import { format, eachDayOfInterval } from 'date-fns';

export interface MermaEntry {
  id: string;
  created_at: string;
  quantity: number;
  cost_value: number;
  product_name: string;
  reason: string;
}

export interface ReportEntry {
  id: string;
  created_at: string;
  total: number;
  payment_type: string;
  type: 'sale' | 'service';
  user_id: string;
  status?: string;
}

export interface EmployeeReport {
  id: string;
  name: string;
  salesCount: number;
  servicesCount: number;
  totalCollected: number;
  tips: number;
  estimatedSalary: number;
}

export function useReportData(period: Period) {
  const { profile } = useAuth();
  const businessId = profile?.business_id;
  const branchId = profile?.branch_id;

  const currentRange = useMemo(() => getDateRange(period), [period]);
  const previousRange = useMemo(() => getPreviousDateRange(period), [period]);

  // Fetch sales
  const { data: allSales = [], isLoading: loadingSales } = useQuery({
    queryKey: ['report-sales', businessId, branchId],
    queryFn: async () => {
      let query = supabase
        .from('sales')
        .select('id, created_at, total, payment_type, user_id, status, cash_amount, transfer_amount')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });
      if (branchId) query = query.eq('branch_id', branchId);
      const { data } = await query;
      return (data || []).map((s: any) => ({
        id: s.id,
        created_at: s.created_at,
        total: Number(s.total),
        payment_type: s.payment_type,
        user_id: s.user_id,
        status: s.status,
        type: 'sale' as const,
      }));
    },
    enabled: !!businessId,
  });

  // Fetch services
  const { data: allServices = [], isLoading: loadingServices } = useQuery({
    queryKey: ['report-services', businessId, branchId],
    queryFn: async () => {
      let query = supabase
        .from('service_entries')
        .select('id, created_at, amount, payment_type, user_id')
        .eq('business_id', businessId!)
        .order('created_at', { ascending: false });
      if (branchId) query = query.eq('branch_id', branchId);
      const { data } = await query;
      return (data || []).map((s: any) => ({
        id: s.id,
        created_at: s.created_at,
        total: Number(s.amount),
        payment_type: s.payment_type,
        user_id: s.user_id,
        type: 'service' as const,
      }));
    },
    enabled: !!businessId,
  });

  // Fetch daily reports for employee tab
  const { data: dailyReports = [], isLoading: loadingReports } = useQuery({
    queryKey: ['report-daily', businessId, branchId, format(currentRange.start, 'yyyy-MM-dd'), format(currentRange.end, 'yyyy-MM-dd')],
    queryFn: async () => {
      let query = supabase
        .from('daily_reports')
        .select('*, profiles!daily_reports_employee_id_fkey(full_name)')
        .eq('business_id', businessId!)
        .gte('date', format(currentRange.start, 'yyyy-MM-dd'))
        .lte('date', format(currentRange.end, 'yyyy-MM-dd'))
        .order('date', { ascending: false });
      if (branchId) query = query.eq('branch_id', branchId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  // Fetch mermas (losses)
  const { data: allMermas = [], isLoading: loadingMermas } = useQuery({
    queryKey: ['report-mermas', businessId, branchId],
    queryFn: async () => {
      let query = supabase
        .from('inventory_movements')
        .select('id, created_at, quantity, notes, product_id')
        .eq('movement_type', 'loss')
        .order('created_at', { ascending: false });
      if (branchId) query = query.eq('branch_id', branchId);
      const { data } = await query;
      if (!data?.length) return [];

      const productIds = [...new Set(data.map(m => m.product_id))];
      const { data: products } = await supabase
        .from('products')
        .select('id, name, cost_price')
        .in('id', productIds);
      const productMap = new Map(products?.map(p => [p.id, p]) || []);

      return data.map(m => {
        const product = productMap.get(m.product_id);
        const notesStr = m.notes || '';
        const reasonMatch = notesStr.match(/^Merma:\s*(\S+)/i);
        return {
          id: m.id,
          created_at: m.created_at,
          quantity: m.quantity,
          cost_value: m.quantity * Number(product?.cost_price || 0),
          product_name: product?.name || 'Producto eliminado',
          reason: reasonMatch ? reasonMatch[1] : 'Otro',
        } as MermaEntry;
      });
    },
    enabled: !!businessId,
  });

  // Seller name map
  const { data: sellerMap = new Map<string, string>() } = useQuery({
    queryKey: ['report-sellers', businessId],
    queryFn: async () => {
      if (!businessId) return new Map<string, string>();
      const { data: employees } = await supabase
        .from('employees')
        .select('full_name, email')
        .eq('business_id', businessId);
      const map = new Map<string, string>();
      if (employees?.length) {
        const emails = employees.map(e => e.email).filter(Boolean) as string[];
        if (emails.length) {
          const { data: profileLinks } = await supabase.rpc('get_profiles_by_emails', { emails });
          const emailToName = new Map<string, string>();
          employees.forEach(e => { if (e.email) emailToName.set(e.email, e.full_name); });
          profileLinks?.forEach((p: any) => {
            const name = emailToName.get(p.email);
            if (name) map.set(p.user_id, name);
          });
        }
      }
      if (profile) map.set(profile.user_id, profile.full_name);
      return map;
    },
    enabled: !!businessId,
  });

  // Current period entries
  const currentSales = useMemo(() => allSales.filter(s => isInRange(s.created_at, currentRange)), [allSales, currentRange]);
  const currentServices = useMemo(() => allServices.filter(s => isInRange(s.created_at, currentRange)), [allServices, currentRange]);
  const currentAll = useMemo(() => [...currentSales, ...currentServices], [currentSales, currentServices]);

  // Mermas in current period
  const currentMermas = useMemo(() => allMermas.filter(m => isInRange(m.created_at, currentRange)), [allMermas, currentRange]);

  // Previous period entries
  const prevSales = useMemo(() => allSales.filter(s => isInRange(s.created_at, previousRange)), [allSales, previousRange]);
  const prevServices = useMemo(() => allServices.filter(s => isInRange(s.created_at, previousRange)), [allServices, previousRange]);
  const prevAll = useMemo(() => [...prevSales, ...prevServices], [prevSales, prevServices]);

  // Daily breakdown for bar chart
  const dailyBreakdown = useMemo(() => {
    const days = eachDayOfInterval({ start: currentRange.start, end: currentRange.end });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const label = format(day, 'dd/MM');
      const daySales = currentSales.filter(s => s.created_at.startsWith(dayStr));
      const dayServs = currentServices.filter(s => s.created_at.startsWith(dayStr));
      return {
        label,
        ventas: daySales.reduce((sum, s) => sum + s.total, 0),
        servicios: dayServs.reduce((sum, s) => sum + s.total, 0),
      };
    });
  }, [currentSales, currentServices, currentRange]);

  // Employee aggregates from daily_reports
  const employeeData = useMemo<EmployeeReport[]>(() => {
    const map = new Map<string, EmployeeReport>();
    dailyReports.forEach((r: any) => {
      const name = r.profiles?.full_name || 'Empleado';
      const existing = map.get(r.employee_id) || {
        id: r.employee_id,
        name,
        salesCount: 0,
        servicesCount: 0,
        totalCollected: 0,
        tips: 0,
        estimatedSalary: 0,
      };
      existing.totalCollected += Number(r.total_sales_day);
      existing.servicesCount += Number(r.total_services) > 0 ? 1 : 0;
      existing.salesCount += Number(r.total_commissions) > 0 ? 1 : 0;
      existing.tips += Number(r.tips);
      existing.estimatedSalary += Number(r.total_salary);
      map.set(r.employee_id, existing);
    });
    return Array.from(map.values());
  }, [dailyReports]);

  const isLoading = loadingSales || loadingServices || loadingReports || loadingMermas;

  return {
    isLoading,
    currentSales,
    currentServices,
    currentAll,
    currentMermas,
    prevSales,
    prevServices,
    prevAll,
    dailyBreakdown,
    employeeData,
    dailyReports,
    sellerMap,
    currentRange,
    previousRange,
  };
}
