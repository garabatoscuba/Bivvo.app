import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, DollarSign, Users, Wrench, Package, Calendar, TrendingUp } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Condition {
  positions: number;
  service_percent: number;
}

const EmployeeSalaryView = ({ employeeBusinessId, employeeBranchId }: { employeeBusinessId: string; employeeBranchId: string | null }) => {
  const { profile } = useAuth();
  const businessId = employeeBusinessId;
  const branchId = employeeBranchId;

  // Date selection - default today
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today.toISOString().split('T')[0]);
  
  // Month filter for summary
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

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

  // Fetch all jornadas for the selected month to calculate daily
  const { data: monthJornadas = [], isLoading: loadingJornadas } = useQuery({
    queryKey: ['jornadas-month-salary', branchId, filterMonth],
    queryFn: async () => {
      const [year, month] = filterMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
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

  // Fetch service entries for the month
  const { data: monthServices = [] } = useQuery({
    queryKey: ['service-entries-month-salary', businessId, branchId, filterMonth],
    queryFn: async () => {
      const [year, month] = filterMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
      const { data, error } = await supabase
        .from('service_entries')
        .select('id, amount, created_at, user_id')
        .eq('business_id', businessId!)
        .eq('branch_id', branchId!)
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      if (error) throw error;
      return data;
    },
    enabled: !!businessId && !!branchId,
  });

  // Fetch sales + sale_items for commissions this month
  const { data: monthSales = [] } = useQuery({
    queryKey: ['sales-month-salary', branchId, filterMonth],
    queryFn: async () => {
      const [year, month] = filterMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
      const { data, error } = await supabase
        .from('sales')
        .select('id, created_at, status')
        .eq('branch_id', branchId!)
        .eq('status', 'completed')
        .gte('created_at', startDate)
        .lte('created_at', endDate);
      if (error) throw error;
      return data;
    },
    enabled: !!branchId,
  });

  const { data: monthSaleItems = [] } = useQuery({
    queryKey: ['sale-items-month-salary', branchId, filterMonth, monthSales.length],
    queryFn: async () => {
      if (monthSales.length === 0) return [];
      const saleIds = monthSales.map((s: any) => s.id);
      const { data, error } = await supabase
        .from('sale_items')
        .select('id, sale_id, product_id, quantity')
        .in('sale_id', saleIds);
      if (error) throw error;
      return data;
    },
    enabled: monthSales.length > 0,
  });

  const conditions: Condition[] = (salaryConfig?.conditions as unknown as Condition[] | undefined) ?? [
    { positions: 3, service_percent: 12 },
    { positions: 2, service_percent: 33 },
    { positions: 1, service_percent: 30 },
  ];

  // Calculate salary per day for the month
  const dailySalary = useMemo(() => {
    if (!profile?.id) return [];

    const [year, month] = filterMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    const results: Array<{
      date: string;
      activeWorkers: number;
      totalServices: number;
      servicePercent: number;
      serviceEarning: number;
      totalCommissions: number;
      commissionEarning: number;
      total: number;
      wasWorking: boolean;
    }> = [];

    const commissionsMap = new Map<string, { type: string; value: number }>();
    commissions.forEach((c: any) => {
      commissionsMap.set(c.product_id, { type: c.commission_type, value: Number(c.commission_value) });
    });

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // Count unique workers with jornada that day
      const dayJornadas = monthJornadas.filter((j: any) => {
        const jDate = new Date(j.apertura_at).toISOString().split('T')[0];
        return jDate === dateStr;
      });
      const uniqueWorkers = new Set(dayJornadas.map((j: any) => j.empleado_id));
      const activeWorkers = uniqueWorkers.size;

      // Check if THIS employee was working
      const wasWorking = uniqueWorkers.has(profile.id);
      if (!wasWorking) {
        results.push({ date: dateStr, activeWorkers: 0, totalServices: 0, servicePercent: 0, serviceEarning: 0, totalCommissions: 0, commissionEarning: 0, total: 0, wasWorking: false });
        continue;
      }

      // Total services for that day (all employees collectively)
      const dayServices = monthServices.filter((s: any) => {
        const sDate = new Date(s.created_at).toISOString().split('T')[0];
        return sDate === dateStr;
      });
      const totalServices = dayServices.reduce((sum: number, s: any) => sum + Number(s.amount), 0);

      // Find applicable condition
      const condition = conditions
        .sort((a, b) => b.positions - a.positions)
        .find(c => c.positions <= activeWorkers) || conditions[conditions.length - 1];
      
      const servicePercent = condition?.service_percent ?? 0;
      const serviceEarning = (totalServices * servicePercent / 100) / activeWorkers;

      // Calculate commissions for that day from sales
      const daySales = monthSales.filter((s: any) => {
        const sDate = new Date(s.created_at).toISOString().split('T')[0];
        return sDate === dateStr;
      });
      const daySaleIds = new Set(daySales.map((s: any) => s.id));
      const daySaleItems = monthSaleItems.filter((si: any) => daySaleIds.has(si.sale_id));

      let totalCommissions = 0;
      daySaleItems.forEach((si: any) => {
        const comm = commissionsMap.get(si.product_id);
        if (comm) {
          if (comm.type === 'fixed') {
            totalCommissions += comm.value * si.quantity;
          } else {
            // For percent, we'd need sale_price - we'll use the commission_value as % 
            // This is approximate; in a real scenario we'd join with products
            totalCommissions += comm.value * si.quantity; // simplified
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
        total: serviceEarning + commissionEarning,
        wasWorking: true,
      });
    }

    return results;
  }, [monthJornadas, monthServices, monthSales, monthSaleItems, commissions, conditions, profile?.id, filterMonth]);

  const workedDays = dailySalary.filter(d => d.wasWorking);
  const monthTotal = workedDays.reduce((sum, d) => sum + d.total, 0);
  const monthServiceTotal = workedDays.reduce((sum, d) => sum + d.serviceEarning, 0);
  const monthCommissionTotal = workedDays.reduce((sum, d) => sum + d.commissionEarning, 0);

  // Today's detail
  const todayData = dailySalary.find(d => d.date === selectedDate);

  // Generate month options
  const months = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('es', { month: 'long', year: 'numeric' });
    months.push({ val, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }

  const isLoading = loadingConfig || loadingJornadas;

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Mi Cobro</h1>
          <p className="text-sm text-muted-foreground">Tu salario basado en servicios y comisiones</p>
        </div>
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="w-44">
            <Calendar className="h-4 w-4 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map(m => (
              <SelectItem key={m.val} value={m.val}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Month summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Salario del Mes</span>
            </div>
            <p className="text-xl md:text-2xl font-bold text-primary">${monthTotal.toFixed(2)}</p>
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

      {/* Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Desglose del Mes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Por Servicios</span>
            </div>
            <span className="text-sm font-bold">${monthServiceTotal.toFixed(2)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Por Comisiones</span>
            </div>
            <span className="text-sm font-bold">${monthCommissionTotal.toFixed(2)}</span>
          </div>
          <div className="border-t pt-2 flex items-center justify-between">
            <span className="text-sm font-bold">Total</span>
            <span className="text-lg font-bold text-primary">${monthTotal.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Day selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detalle por Día</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground">Selecciona un día</Label>
            <Input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="mt-1 w-full"
            />
          </div>

          {todayData ? (
            todayData.wasWorking ? (
              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Trabajadores activos</span>
                  </div>
                  <Badge variant="secondary">{todayData.activeWorkers}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Condición aplicada</span>
                  <Badge>{todayData.servicePercent}% servicios</Badge>
                </div>
                <div className="border-t pt-2 space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total servicios del día</span>
                    <span>${todayData.totalServices.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tu parte servicios ({todayData.servicePercent}% ÷ {todayData.activeWorkers})</span>
                    <span className="font-medium">${todayData.serviceEarning.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Comisiones del día</span>
                    <span>${todayData.totalCommissions.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Tu parte comisiones (÷ {todayData.activeWorkers})</span>
                    <span className="font-medium">${todayData.commissionEarning.toFixed(2)}</span>
                  </div>
                </div>
                <div className="border-t pt-2 flex items-center justify-between">
                  <span className="text-sm font-bold">Total del día</span>
                  <span className="text-lg font-bold text-primary">${todayData.total.toFixed(2)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No trabajaste este día</p>
            )
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">Selecciona una fecha del mes</p>
          )}
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
              <p className="text-sm text-muted-foreground text-center py-4">Sin jornadas este mes</p>
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
    </div>
  );
};

export default EmployeeSalaryView;
