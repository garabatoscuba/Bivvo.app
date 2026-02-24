import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, DollarSign, Users, Wrench, Package, Calendar, TrendingUp, Save, Calculator, Coins, ArrowRightLeft, Gift, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Condition {
  positions: number;
  service_percent: number;
}

const BILL_DENOMINATIONS = [1, 3, 5, 10, 20, 50, 100, 200, 500, 1000];

type FilterPeriod = 'today' | 'week' | 'month' | 'year';

const EmployeeSalaryView = ({ employeeBusinessId, employeeBranchId }: { employeeBusinessId: string; employeeBranchId: string | null }) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const businessId = employeeBusinessId;
  const branchId = employeeBranchId;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('today');
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Calculator state
  const [bills, setBills] = useState<Record<number, number>>(
    Object.fromEntries(BILL_DENOMINATIONS.map(d => [d, 0]))
  );

  const handleBillChange = (denom: number, qty: number) => {
    setBills(prev => ({ ...prev, [denom]: isNaN(qty) ? 0 : qty }));
  };
  const totalCash = BILL_DENOMINATIONS.reduce((sum, d) => sum + d * (bills[d] || 0), 0);

  // Compute date range based on filter
  const dateRange = useMemo(() => {
    const now = new Date();
    let start: string, end: string;
    if (filterPeriod === 'today') {
      start = todayStr;
      end = todayStr;
    } else if (filterPeriod === 'week') {
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      start = monday.toISOString().split('T')[0];
      end = todayStr;
    } else if (filterPeriod === 'month') {
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      end = todayStr;
    } else {
      start = `${now.getFullYear()}-01-01`;
      end = todayStr;
    }
    return { start, end };
  }, [filterPeriod, todayStr]);

  // Fetch salary config
  const { data: salaryConfig, isLoading: loadingConfig } = useQuery({
    queryKey: ['salary-config', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_config')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  // Fetch product commissions
  const { data: commissions = [] } = useQuery({
    queryKey: ['product-commissions', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_commissions')
        .select('*, products(name)')
        .eq('business_id', businessId);
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  // Fetch jornadas for date range
  const { data: rangeJornadas = [], isLoading: loadingJornadas } = useQuery({
    queryKey: ['jornadas-range-salary', branchId, dateRange.start, dateRange.end],
    queryFn: async () => {
      const startDate = dateRange.start + 'T00:00:00';
      const endDate = dateRange.end + 'T23:59:59';
      const { data, error } = await supabase
        .from('jornadas')
        .select('id, empleado_id, apertura_at, cierre_at, sucursal_id')
        .eq('sucursal_id', branchId!)
        .gte('apertura_at', startDate)
        .lte('apertura_at', endDate);
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  // Fetch service entries for range
  const { data: rangeServices = [] } = useQuery({
    queryKey: ['service-entries-range-salary', businessId, branchId, dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_entries')
        .select('id, amount, created_at, user_id, payment_type')
        .eq('business_id', businessId!)
        .eq('branch_id', branchId!)
        .gte('created_at', dateRange.start + 'T00:00:00')
        .lte('created_at', dateRange.end + 'T23:59:59');
      if (error) throw error;
      return data;
    },
    enabled: !!businessId && !!branchId,
  });

  // Check if today is already closed
  const { data: todayReport } = useQuery({
    queryKey: ['daily-report-today', branchId, todayStr, profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('id')
        .eq('employee_id', profile!.id)
        .eq('date', todayStr)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Fetch sales for range
  const { data: rangeSales = [] } = useQuery({
    queryKey: ['sales-range-salary', branchId, dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('id, created_at, status, payment_type, total')
        .eq('branch_id', branchId!)
        .eq('status', 'completed')
        .gte('created_at', dateRange.start + 'T00:00:00')
        .lte('created_at', dateRange.end + 'T23:59:59');
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  const { data: rangeSaleItems = [] } = useQuery({
    queryKey: ['sale-items-range-salary', branchId, dateRange.start, dateRange.end, rangeSales.length],
    queryFn: async () => {
      if (rangeSales.length === 0) return [];
      const saleIds = rangeSales.map((s: any) => s.id);
      const { data, error } = await supabase
        .from('sale_items')
        .select('id, sale_id, product_id, quantity, unit_price')
        .in('sale_id', saleIds);
      if (error) throw error;
      return data;
    },
    enabled: rangeSales.length > 0,
  });

  const conditions: Condition[] = (salaryConfig?.conditions as unknown as Condition[] | undefined) ?? [
    { positions: 3, service_percent: 12 },
    { positions: 2, service_percent: 33 },
    { positions: 1, service_percent: 30 },
  ];

  const commissionsMap = useMemo(() => {
    const map = new Map<string, { type: string; value: number }>();
    commissions.forEach((c: any) => {
      map.set(c.product_id, { type: c.commission_type, value: Number(c.commission_value) });
    });
    return map;
  }, [commissions]);

  // Calculate salary per day for the range
  const dailySalary = useMemo(() => {
    if (!profile?.id) return [];

    const start = new Date(dateRange.start + 'T12:00:00');
    const end = new Date(dateRange.end + 'T12:00:00');
    const results: Array<{
      date: string;
      activeWorkers: number;
      totalServices: number;
      servicePercent: number;
      serviceEarning: number;
      totalCommissions: number;
      commissionEarning: number;
      tips: number;
      total: number;
      wasWorking: boolean;
      serviceCashTotal: number;
      serviceTransferTotal: number;
      salesCashTotal: number;
      salesTransferTotal: number;
      salesTotal: number;
    }> = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];

      const dayJornadas = rangeJornadas.filter((j: any) => {
        const jDate = new Date(j.apertura_at).toISOString().split('T')[0];
        return jDate === dateStr;
      });
      const uniqueWorkers = new Set(dayJornadas.map((j: any) => j.empleado_id));
      const activeWorkers = uniqueWorkers.size;
      const wasWorking = uniqueWorkers.has(profile.id);

      if (!wasWorking) {
        results.push({ date: dateStr, activeWorkers: 0, totalServices: 0, servicePercent: 0, serviceEarning: 0, totalCommissions: 0, commissionEarning: 0, tips: 0, total: 0, wasWorking: false, serviceCashTotal: 0, serviceTransferTotal: 0, salesCashTotal: 0, salesTransferTotal: 0, salesTotal: 0 });
        continue;
      }

      const dayServices = rangeServices.filter((s: any) => new Date(s.created_at).toISOString().split('T')[0] === dateStr);
      const totalServices = dayServices.reduce((sum: number, s: any) => sum + Number(s.amount), 0);
      const serviceCashTotal = dayServices.filter((s: any) => s.payment_type === 'cash').reduce((sum: number, s: any) => sum + Number(s.amount), 0);
      const serviceTransferTotal = dayServices.filter((s: any) => s.payment_type === 'transfer').reduce((sum: number, s: any) => sum + Number(s.amount), 0);

      const condition = conditions
        .sort((a, b) => b.positions - a.positions)
        .find(c => c.positions <= activeWorkers) || conditions[conditions.length - 1];
      const servicePercent = condition?.service_percent ?? 0;

      const serviceEarning = (totalServices * servicePercent / 100) / activeWorkers;

      const daySales = rangeSales.filter((s: any) => new Date(s.created_at).toISOString().split('T')[0] === dateStr);
      const daySaleIds = new Set(daySales.map((s: any) => s.id));
      const daySaleItems = rangeSaleItems.filter((si: any) => daySaleIds.has(si.sale_id));
      
      const salesCashTotal = daySales.filter((s: any) => s.payment_type === 'cash').reduce((sum: number, s: any) => sum + Number(s.total), 0);
      const salesTransferTotal = daySales.filter((s: any) => s.payment_type === 'transfer').reduce((sum: number, s: any) => sum + Number(s.total), 0);
      const salesTotal = salesCashTotal + salesTransferTotal;

      let totalCommissions = 0;
      daySaleItems.forEach((si: any) => {
        const comm = commissionsMap.get(si.product_id);
        if (comm) {
          if (comm.type === 'fixed') {
            totalCommissions += comm.value * si.quantity;
          } else {
            totalCommissions += (Number(si.unit_price) * si.quantity * comm.value / 100);
          }
        }
      });
      const commissionEarning = totalCommissions / activeWorkers;

      results.push({
        date: dateStr,
        activeWorkers,
        totalServices,
        servicePercent,
        serviceEarning,
        totalCommissions,
        commissionEarning,
        tips: 0,
        total: serviceEarning + commissionEarning,
        wasWorking: true,
        serviceCashTotal,
        serviceTransferTotal,
        salesCashTotal,
        salesTransferTotal,
        salesTotal,
      });
    }

    return results;
  }, [rangeJornadas, rangeServices, rangeSales, rangeSaleItems, commissions, conditions, profile?.id, dateRange, commissionsMap]);

  const workedDays = dailySalary.filter(d => d.wasWorking);
  const periodTotal = workedDays.reduce((sum, d) => sum + d.total, 0);
  const todayData = dailySalary.find(d => d.date === todayStr);

  // Calculator breakdown for today
  const calcBreakdown = useMemo(() => {
    if (!todayData || !todayData.wasWorking) return null;
    const d = todayData;
    const totalTransferSystem = d.serviceTransferTotal + d.salesTransferTotal;
    const totalAllTransfers = totalTransferSystem;
    const totalExpectedCash = d.serviceCashTotal + d.salesCashTotal;
    const totalSalesDay = d.totalServices + d.salesTotal;
    const tips = Math.max(0, totalCash - totalExpectedCash);
    const tipsPerWorker = d.activeWorkers > 0 ? tips / d.activeWorkers : tips;
    const moneyToDeliver = totalCash - tips;
    return {
      ...d,
      totalTransferSystem,
      totalAllTransfers,
      totalExpectedCash,
      totalSalesDay,
      tips,
      tipsPerWorker,
      moneyToDeliver,
    };
  }, [todayData, totalCash]);

  // Find active jornada for today
  const todayJornada = useMemo(() => {
    if (!profile?.id) return null;
    return rangeJornadas.find((j: any) => {
      const jDate = new Date(j.apertura_at).toISOString().split('T')[0];
      return jDate === todayStr && j.empleado_id === profile.id && !j.cierre_at;
    });
  }, [rangeJornadas, profile?.id, todayStr]);

  // Close day mutation
  const closeDay = useMutation({
    mutationFn: async () => {
      if (!profile || !calcBreakdown || !branchId || !todayData) throw new Error('Missing data');

      const reportData = {
        business_id: businessId,
        branch_id: branchId,
        employee_id: profile.id,
        user_id: profile.user_id,
        date: todayStr,
        active_workers: todayData.activeWorkers,
        service_percent: todayData.servicePercent,
        total_services: todayData.totalServices,
        total_copies: 0,
        total_commissions: todayData.totalCommissions,
        service_earning: todayData.serviceEarning,
        copies_earning: 0,
        commission_earning: todayData.commissionEarning,
        tips: calcBreakdown.tips,
        total_salary: todayData.total + calcBreakdown.tipsPerWorker,
        cash_counted: totalCash,
        service_cash: todayData.serviceCashTotal,
        service_transfer: todayData.serviceTransferTotal,
        sales_cash: todayData.salesCashTotal,
        sales_transfer: todayData.salesTransferTotal,
        copies_cash: 0,
        copies_transfer: 0,
        total_expected_cash: calcBreakdown.totalExpectedCash,
        total_transfers: calcBreakdown.totalAllTransfers,
        total_sales_day: calcBreakdown.totalSalesDay,
        money_to_deliver: calcBreakdown.moneyToDeliver,
        jornada_id: todayJornada?.id || null,
      };

      const { error: reportError } = await supabase
        .from('daily_reports')
        .upsert(reportData, { onConflict: 'employee_id,date' });
      if (reportError) throw reportError;

      if (todayJornada) {
        const now = new Date().toISOString();
        const apertura = new Date(todayJornada.apertura_at);
        const duracion = Math.round((Date.now() - apertura.getTime()) / 60000);
        const { error: jornadaError } = await supabase
          .from('jornadas')
          .update({ cierre_at: now, duracion_min: duracion, metodo_cierre: 'cierre_dia' })
          .eq('id', todayJornada.id);
        if (jornadaError) throw jornadaError;
      }

      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          business_id: businessId,
          branch_id: branchId,
          type: 'daily_report',
          title: `Reporte de cierre: ${profile.full_name}`,
          message: `${profile.full_name} cerró su día. Salario: $${(todayData.total + calcBreakdown.tipsPerWorker).toFixed(2)}, Entrega: $${calcBreakdown.moneyToDeliver.toFixed(2)}, Propinas: $${calcBreakdown.tips.toFixed(2)}`,
          metadata: {
            employee_name: profile.full_name,
            date: todayStr,
            total_salary: todayData.total + calcBreakdown.tipsPerWorker,
            money_to_deliver: calcBreakdown.moneyToDeliver,
            tips: calcBreakdown.tips,
            cash_counted: totalCash,
            total_transfers: calcBreakdown.totalAllTransfers,
            total_sales_day: calcBreakdown.totalSalesDay,
          },
        });
      if (notifError) console.error('Notification error:', notifError);
    },
    onSuccess: () => {
      toast.success('Día cerrado exitosamente');
      queryClient.invalidateQueries({ queryKey: ['daily-report-today'] });
      queryClient.invalidateQueries({ queryKey: ['jornadas'] });
      queryClient.invalidateQueries({ queryKey: ['jornada-activa'] });
    },
    onError: (e) => toast.error('Error al cerrar el día: ' + (e as Error).message),
  });

  const isLoading = loadingConfig || loadingJornadas;
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const isDayClosed = !!todayReport;
  const isToday = filterPeriod === 'today';

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Mi Cobro</h1>
          <p className="text-sm text-muted-foreground">Salario, calculadora y cierre de día</p>
        </div>
        <Select value={filterPeriod} onValueChange={(v) => setFilterPeriod(v as FilterPeriod)}>
          <SelectTrigger className="w-36">
            <Calendar className="h-4 w-4 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoy</SelectItem>
            <SelectItem value="week">Semana</SelectItem>
            <SelectItem value="month">Mes</SelectItem>
            <SelectItem value="year">Año</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* === TODAY VIEW === */}
      {isToday && (
        <>
          {/* Day closed banner */}
          {isDayClosed && (
            <Card className="border-accent/50 bg-accent/10">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-accent-foreground" />
                <div>
                  <p className="text-sm font-bold text-accent-foreground">Día cerrado</p>
                  <p className="text-xs text-muted-foreground">Tu reporte fue enviado al administrador</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Today's salary */}
          {todayData && todayData.wasWorking && (
            <Card className="border-primary">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">💰 Salario de Hoy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Condición activa</span>
                  <Badge>{todayData.activeWorkers} puesto{todayData.activeWorkers > 1 ? 's' : ''} → {todayData.servicePercent}%</Badge>
                </div>
                <div className="border-t pt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Servicios ({todayData.servicePercent}% de ${todayData.totalServices.toFixed(2)} ÷ {todayData.activeWorkers})</span>
                    <span className="font-medium">${todayData.serviceEarning.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Comisiones (${todayData.totalCommissions.toFixed(2)} ÷ {todayData.activeWorkers})</span>
                    <span className="font-medium">${todayData.commissionEarning.toFixed(2)}</span>
                  </div>
                  {calcBreakdown && calcBreakdown.tipsPerWorker > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1"><Gift className="h-3 w-3" /> Propinas (÷ {todayData.activeWorkers})</span>
                      <span className="font-medium">${calcBreakdown.tipsPerWorker.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                <div className="border-t pt-2 flex items-center justify-between">
                  <span className="text-sm font-bold">Total del día</span>
                  <span className="text-xl font-bold text-primary">
                    ${(todayData.total + (calcBreakdown?.tipsPerWorker || 0)).toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cash calculator */}
          {!isDayClosed && todayData?.wasWorking && (
            <>
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calculator className="h-4 w-4" /> Conteo de Efectivo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-3 gap-1 text-xs font-medium text-muted-foreground border-b pb-1.5">
                    <span>Billete</span><span className="text-center">Cant.</span><span className="text-right">Total</span>
                  </div>
                  {BILL_DENOMINATIONS.map(denom => (
                    <div key={denom} className="grid grid-cols-3 gap-1 items-center">
                      <span className="text-sm font-medium">${denom}</span>
                      <Input type="number" min={0} value={bills[denom] || ''} onChange={e => handleBillChange(denom, parseInt(e.target.value))} className="h-8 text-center text-sm" placeholder="0" />
                      <span className="text-sm font-bold text-right">${(denom * (bills[denom] || 0)).toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold flex items-center gap-1"><Coins className="h-4 w-4" /> Total Efectivo</span>
                    <span className="text-lg font-bold text-primary">${totalCash.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Transfers */}
              {calcBreakdown && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ArrowRightLeft className="h-4 w-4" /> Transferencias del Día
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground"><Wrench className="h-3.5 w-3.5" /> Servicios</span>
                      <span className="font-medium">${calcBreakdown.serviceTransferTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-1.5 text-muted-foreground"><Package className="h-3.5 w-3.5" /> Punto de Venta</span>
                      <span className="font-medium">${calcBreakdown.salesTransferTotal.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="text-sm font-bold">Total Transferencias</span>
                      <span className="text-lg font-bold text-primary">${calcBreakdown.totalAllTransfers.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Day summary */}
              {calcBreakdown && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Resumen del Día</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Venta servicios</span>
                      <span>${calcBreakdown.totalServices.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Venta productos</span>
                      <span>${calcBreakdown.salesTotal.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="text-sm font-bold">Venta Total del Día</span>
                      <span className="font-bold">${calcBreakdown.totalSalesDay.toFixed(2)}</span>
                    </div>

                    <div className="border-t pt-2 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Efectivo esperado</span>
                        <span>${calcBreakdown.totalExpectedCash.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Efectivo contado</span>
                        <span>${totalCash.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="border-t pt-2 flex justify-between items-center">
                      <span className="text-sm font-bold flex items-center gap-1"><Gift className="h-4 w-4" /> Propinas</span>
                      <div className="text-right">
                        <span className="text-lg font-bold">${calcBreakdown.tips.toFixed(2)}</span>
                        {calcBreakdown.activeWorkers > 1 && (
                          <p className="text-xs text-muted-foreground">${calcBreakdown.tipsPerWorker.toFixed(2)} c/u ({calcBreakdown.activeWorkers} trab.)</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg bg-primary/10 p-3 flex justify-between items-center">
                      <span className="text-sm font-bold">A entregar</span>
                      <span className="text-xl font-bold text-primary">${calcBreakdown.moneyToDeliver.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Close Day Button */}
              {calcBreakdown && totalCash > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full" size="lg" disabled={closeDay.isPending}>
                      {closeDay.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Cerrar Día y Enviar Reporte
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Cerrar el día?</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>Se guardará tu reporte y se cerrará tu jornada.</p>
                        <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                          <div className="flex justify-between"><span>Salario del día:</span><span className="font-bold">${(todayData!.total + calcBreakdown.tipsPerWorker).toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>Propinas:</span><span className="font-bold">${calcBreakdown.tipsPerWorker.toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>Dinero a entregar:</span><span className="font-bold">${calcBreakdown.moneyToDeliver.toFixed(2)}</span></div>
                          <div className="flex justify-between"><span>Transferencias:</span><span className="font-bold">${calcBreakdown.totalAllTransfers.toFixed(2)}</span></div>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => closeDay.mutate()}>Confirmar Cierre</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </>
          )}

          {todayData && !todayData.wasWorking && (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No tienes jornada activa hoy</CardContent></Card>
          )}
        </>
      )}

      {/* === PERIOD VIEW (week/month/year) === */}
      {!isToday && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Salario Período</span>
                </div>
                <p className="text-xl md:text-2xl font-bold text-primary">${periodTotal.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Días Trabajados</span>
                </div>
                <p className="text-xl md:text-2xl font-bold">{workedDays.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Day selector for specific day analysis */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Analizar un día</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full" />
              {(() => {
                const dayData = dailySalary.find(d => d.date === selectedDate);
                if (!dayData) return <p className="text-sm text-muted-foreground text-center py-4">Fecha fuera del período</p>;
                if (!dayData.wasWorking) return <p className="text-sm text-muted-foreground text-center py-4">No trabajaste este día</p>;
                return (
                  <div className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm"><Users className="h-4 w-4 inline mr-1" />Trabajadores</span>
                      <Badge variant="secondary">{dayData.activeWorkers}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Condición</span>
                      <Badge>{dayData.servicePercent}%</Badge>
                    </div>
                    <div className="border-t pt-2 space-y-1">
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Servicios</span><span>${dayData.serviceEarning.toFixed(2)}</span></div>
                      <div className="flex justify-between text-sm"><span className="text-muted-foreground">Comisiones</span><span>${dayData.commissionEarning.toFixed(2)}</span></div>
                    </div>
                    <div className="border-t pt-2 flex justify-between">
                      <span className="text-sm font-bold">Total</span>
                      <span className="text-lg font-bold text-primary">${dayData.total.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Daily breakdown list */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Historial Diario</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                {workedDays.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Sin jornadas en este período</p>
                ) : (
                  workedDays.map(day => (
                    <div
                      key={day.date}
                      className={`flex items-center justify-between rounded-lg border p-2.5 cursor-pointer transition-colors ${
                        selectedDate === day.date ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                      onClick={() => setSelectedDate(day.date)}
                    >
                      <div>
                        <p className="text-sm font-medium">
                          {new Date(day.date + 'T12:00:00').toLocaleDateString('es', { weekday: 'short', day: '2-digit', month: 'short' })}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[9px]">{day.activeWorkers} trab.</Badge>
                          <Badge variant="outline" className="text-[9px]">{day.servicePercent}%</Badge>
                        </div>
                      </div>
                      <span className="text-sm font-bold">${day.total.toFixed(2)}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default EmployeeSalaryView;
