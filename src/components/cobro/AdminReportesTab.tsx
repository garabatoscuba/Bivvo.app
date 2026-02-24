import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, DollarSign, Users, Calendar, TrendingUp, Banknote } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

type FilterPeriod = 'today' | 'week' | 'month' | 'year';

const AdminReportesTab = ({ businessId }: { businessId: string }) => {
  const { profile } = useAuth();
  const branchId = profile?.branch_id;

  const todayStr = new Date().toISOString().split('T')[0];
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>('today');
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const dateRange = useMemo(() => {
    const now = new Date();
    let start: string, end: string;
    if (filterPeriod === 'today') {
      start = todayStr; end = todayStr;
    } else if (filterPeriod === 'week') {
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      start = monday.toISOString().split('T')[0]; end = todayStr;
    } else if (filterPeriod === 'month') {
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`; end = todayStr;
    } else {
      start = `${now.getFullYear()}-01-01`; end = todayStr;
    }
    return { start, end };
  }, [filterPeriod, todayStr]);

  // Fetch reports for the range
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['admin-daily-reports', businessId, branchId, dateRange.start, dateRange.end],
    queryFn: async () => {
      let query = supabase
        .from('daily_reports')
        .select('*, profiles!daily_reports_employee_id_fkey(full_name)')
        .eq('business_id', businessId)
        .gte('date', dateRange.start)
        .lte('date', dateRange.end)
        .order('date', { ascending: false });
      
      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  // Aggregate by employee
  const employeeAggregates = useMemo(() => {
    const map = new Map<string, {
      name: string;
      totalSalary: number;
      totalMoneyToDeliver: number;
      totalTips: number;
      totalSalesDay: number;
      daysWorked: number;
    }>();

    reports.forEach((r: any) => {
      const name = r.profiles?.full_name || 'Empleado';
      const existing = map.get(r.employee_id) || {
        name,
        totalSalary: 0,
        totalMoneyToDeliver: 0,
        totalTips: 0,
        totalSalesDay: 0,
        daysWorked: 0,
      };
      existing.totalSalary += Number(r.total_salary);
      existing.totalMoneyToDeliver += Number(r.money_to_deliver);
      existing.totalTips += Number(r.tips);
      existing.totalSalesDay += Number(r.total_sales_day);
      existing.daysWorked += 1;
      map.set(r.employee_id, existing);
    });

    return Array.from(map.entries()).map(([id, data]) => ({ id, ...data }));
  }, [reports]);

  // Filter reports by specific date for detail view
  const dateReports = useMemo(() => {
    return reports.filter((r: any) => r.date === selectedDate);
  }, [reports, selectedDate]);

  const totalSalaries = employeeAggregates.reduce((s, e) => s + e.totalSalary, 0);
  const totalToDeliver = employeeAggregates.reduce((s, e) => s + e.totalMoneyToDeliver, 0);
  const totalTips = employeeAggregates.reduce((s, e) => s + e.totalTips, 0);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-bold">Reportes de Cierre</h2>
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

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Salarios</span>
            </div>
            <p className="text-lg font-bold">${totalSalaries.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <Banknote className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">A entregar</span>
            </div>
            <p className="text-lg font-bold">${totalToDeliver.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-muted-foreground">Propinas</span>
            </div>
            <p className="text-lg font-bold">${totalTips.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per employee summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Por Empleado
          </CardTitle>
        </CardHeader>
        <CardContent>
          {employeeAggregates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin reportes en este período</p>
          ) : (
            <div className="space-y-3">
              {employeeAggregates.map(emp => (
                <div key={emp.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{emp.name}</span>
                    <Badge variant="outline" className="text-[10px]">{emp.daysWorked} día{emp.daysWorked > 1 ? 's' : ''}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Salario</span>
                      <p className="font-bold">${emp.totalSalary.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Entrega</span>
                      <p className="font-bold text-primary">${emp.totalMoneyToDeliver.toFixed(2)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Propinas</span>
                      <p className="font-bold">${emp.totalTips.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Specific day analysis */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detalle por Día</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="w-full" />
          {dateReports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin reportes para esta fecha</p>
          ) : (
            <div className="space-y-3">
              {dateReports.map((r: any) => (
                <div key={r.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{r.profiles?.full_name || 'Empleado'}</span>
                    <Badge>{r.active_workers} puesto{r.active_workers > 1 ? 's' : ''} → {r.service_percent}%</Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Servicios</span><span>${Number(r.total_services).toFixed(2)}</span></div>
                    
                    <div className="flex justify-between"><span className="text-muted-foreground">Comisiones</span><span>${Number(r.total_commissions).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Venta total</span><span>${Number(r.total_sales_day).toFixed(2)}</span></div>
                  </div>
                  <div className="border-t pt-2 space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Efectivo contado</span><span>${Number(r.cash_counted).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Transferencias</span><span>${Number(r.total_transfers).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Propinas</span><span>${Number(r.tips).toFixed(2)}</span></div>
                  </div>
                  <div className="border-t pt-2 grid grid-cols-2 gap-2">
                    <div className="rounded bg-primary/10 p-2 text-center">
                      <span className="text-xs text-muted-foreground">Salario</span>
                      <p className="text-sm font-bold text-primary">${Number(r.total_salary).toFixed(2)}</p>
                    </div>
                    <div className="rounded bg-primary/10 p-2 text-center">
                      <span className="text-xs text-muted-foreground">A entregar</span>
                      <p className="text-sm font-bold text-primary">${Number(r.money_to_deliver).toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminReportesTab;
