import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, DollarSign, TrendingUp, Calendar, BarChart3, Clock } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subWeeks, subMonths, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';

type Period = 'week' | 'month' | 'year';

interface EmployeeSalaryViewProps {
  employeeBusinessId: string;
  employeeBranchId: string | null;
}

const EmployeeSalaryView = ({ employeeBusinessId, employeeBranchId }: EmployeeSalaryViewProps) => {
  const { profile } = useAuth();
  const businessId = employeeBusinessId;
  const [period, setPeriod] = useState<Period>('week');

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now) };
    }
  }, [period]);

  // Previous period for comparison
  const prevRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case 'week': {
        const prev = subWeeks(now, 1);
        return { start: startOfWeek(prev, { weekStartsOn: 1 }), end: endOfWeek(prev, { weekStartsOn: 1 }) };
      }
      case 'month': {
        const prev = subMonths(now, 1);
        return { start: startOfMonth(prev), end: endOfMonth(prev) };
      }
      case 'year': {
        const prevYear = new Date(now.getFullYear() - 1, 0, 1);
        return { start: startOfYear(prevYear), end: endOfYear(prevYear) };
      }
    }
  }, [period]);

  const startStr = format(dateRange.start, 'yyyy-MM-dd');
  const endStr = format(dateRange.end, 'yyyy-MM-dd');
  const prevStartStr = format(prevRange.start, 'yyyy-MM-dd');
  const prevEndStr = format(prevRange.end, 'yyyy-MM-dd');

  // Fetch daily_reports for current period
  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['salary-stats-reports', profile?.user_id, startStr, endStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('date, total_salary, service_earning, commission_earning, tips, total_services, total_sales_day, active_workers, service_percent')
        .eq('user_id', profile!.user_id)
        .eq('business_id', businessId)
        .gte('date', startStr)
        .lte('date', endStr)
        .order('date', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.user_id && !!businessId,
  });

  // Fetch previous period for comparison
  const { data: prevReports = [] } = useQuery({
    queryKey: ['salary-stats-prev', profile?.user_id, prevStartStr, prevEndStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('total_salary')
        .eq('user_id', profile!.user_id)
        .eq('business_id', businessId)
        .gte('date', prevStartStr)
        .lte('date', prevEndStr);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.user_id && !!businessId,
  });

  // KPIs
  const totalEarned = reports.reduce((s, r) => s + Number(r.total_salary), 0);
  const totalServices = reports.reduce((s, r) => s + Number(r.service_earning), 0);
  const totalCommissions = reports.reduce((s, r) => s + Number(r.commission_earning), 0);
  const totalTips = reports.reduce((s, r) => s + Number(r.tips), 0);
  const daysWorked = reports.length;
  const avgPerDay = daysWorked > 0 ? totalEarned / daysWorked : 0;
  const prevTotal = prevReports.reduce((s, r) => s + Number(r.total_salary), 0);
  const changePercent = prevTotal > 0 ? Math.round(((totalEarned - prevTotal) / prevTotal) * 100) : (totalEarned > 0 ? 100 : 0);

  // Chart data
  const chartData = useMemo(() => {
    if (period === 'year') {
      // Group by month
      const months = eachMonthOfInterval(dateRange);
      return months.map(m => {
        const key = format(m, 'yyyy-MM');
        const monthReports = reports.filter(r => r.date.startsWith(key));
        return {
          label: format(m, 'MMM', { locale: es }),
          salary: monthReports.reduce((s, r) => s + Number(r.total_salary), 0),
          services: monthReports.reduce((s, r) => s + Number(r.service_earning), 0),
          commissions: monthReports.reduce((s, r) => s + Number(r.commission_earning), 0),
        };
      });
    }

    // For week/month show daily
    const days = eachDayOfInterval(dateRange);
    return days.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const dayReport = reports.find(r => r.date === dateStr);
      return {
        label: period === 'week'
          ? format(d, 'EEE', { locale: es })
          : format(d, 'dd'),
        salary: dayReport ? Number(dayReport.total_salary) : 0,
        services: dayReport ? Number(dayReport.service_earning) : 0,
        commissions: dayReport ? Number(dayReport.commission_earning) : 0,
      };
    });
  }, [reports, dateRange, period]);

  // Breakdown by category (for donut-like bars)
  const breakdownData = [
    { name: 'Servicios', value: totalServices, fill: 'hsl(var(--primary))' },
    { name: 'Comisiones', value: totalCommissions, fill: 'hsl(142, 50%, 42%)' },
    { name: 'Propinas', value: totalTips, fill: 'hsl(38, 70%, 48%)' },
  ].filter(d => d.value > 0);

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  const periodLabel = period === 'week' ? 'esta semana' : period === 'month' ? 'este mes' : 'este año';

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg md:text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Estadísticas Salariales
          </h2>
          <p className="text-xs text-muted-foreground">Analiza tus ingresos {periodLabel}</p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-32">
            <Calendar className="h-4 w-4 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Semana</SelectItem>
            <SelectItem value="month">Mes</SelectItem>
            <SelectItem value="year">Año</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Ganado</span>
            </div>
            <p className="text-xl font-bold text-primary">${totalEarned.toFixed(2)}</p>
            {changePercent !== 0 && (
              <p className={`text-[10px] mt-0.5 ${changePercent > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {changePercent > 0 ? '↑' : '↓'} {Math.abs(changePercent)}% vs anterior
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Promedio/Día</span>
            </div>
            <p className="text-xl font-bold">${avgPerDay.toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{daysWorked} días trabajados</p>
          </CardContent>
        </Card>
      </div>

      {/* Salary over time chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Ingresos por {period === 'year' ? 'Mes' : 'Día'}</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.every(d => d.salary === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin datos en este período</p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salaryGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `$${v}`} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Salario']}
                  />
                  <Area type="monotone" dataKey="salary" stroke="hsl(var(--primary))" fill="url(#salaryGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Breakdown */}
      {breakdownData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Desglose de Ingresos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {breakdownData.map(item => {
              const pct = totalEarned > 0 ? (item.value / totalEarned * 100) : 0;
              return (
                <div key={item.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-medium">${item.value.toFixed(2)} <span className="text-xs text-muted-foreground">({pct.toFixed(0)}%)</span></span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: item.fill }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Daily history list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Historial de Reportes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sin reportes en este período</p>
          ) : (
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
              {[...reports].reverse().map(r => (
                <div key={r.date} className="flex items-center justify-between rounded-lg border p-2.5">
                  <div>
                    <p className="text-sm font-medium">
                      {format(new Date(r.date + 'T12:00:00'), "EEE dd MMM", { locale: es })}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[9px]">{r.active_workers} trab.</Badge>
                      <Badge variant="outline" className="text-[9px]">{Number(r.service_percent).toFixed(0)}%</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold">${Number(r.total_salary).toFixed(2)}</span>
                    <div className="text-[10px] text-muted-foreground">
                      S: ${Number(r.service_earning).toFixed(2)} · C: ${Number(r.commission_earning).toFixed(2)}
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

export default EmployeeSalaryView;
