import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  ShoppingCart, Wrench, Package, DollarSign, Clock, TrendingUp,
  LogOut, Trophy, AlertTriangle, Sun, AlertCircle, ThumbsUp, Printer,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import type { DailySalaryBreakdown } from '@/hooks/useDailySalary';
import EquipoActivoSection from '@/components/employees/EquipoActivoSection';

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function getArrivalMessage(aperturaAt: string, schedule: any): { text: string; icon: 'early' | 'ontime' | 'late' } | null {
  if (!schedule) return null;
  const arrival = new Date(aperturaAt);
  const dayKey = DAY_KEYS[arrival.getDay()];
  const daySchedule = schedule[dayKey];
  if (!daySchedule?.enabled || !daySchedule?.open) return null;

  const [openH, openM] = daySchedule.open.split(':').map(Number);
  const scheduledMs = openH * 60 + openM;
  const arrivalMs = arrival.getHours() * 60 + arrival.getMinutes();
  const diff = scheduledMs - arrivalMs; // positive = early

  if (diff >= 10) {
    return { text: `¡Llegaste ${diff} min temprano! Tienes tiempo para organizarte antes de abrir.`, icon: 'early' };
  } else if (diff >= 0) {
    return { text: 'Llegaste raspando. Lo ideal es llegar 10 minutos antes para estar listo para la hora de apertura.', icon: 'ontime' };
  } else {
    return { text: `Llegaste ${Math.abs(diff)} min tarde. Intenta llegar al menos 10 minutos antes.`, icon: 'late' };
  }
}

interface MyEmploymentDashboardProps {
  businessId: string;
  branchId: string;
  jornadaActiva: boolean;
  myJornada: any;
  dailySalary: DailySalaryBreakdown;
  needsCount?: boolean;
  onOpenContarYCerrar: () => void;
}

const MyEmploymentDashboard = ({
  businessId,
  branchId,
  jornadaActiva,
  myJornada,
  dailySalary,
  needsCount = true,
  onOpenContarYCerrar,
}: MyEmploymentDashboardProps) => {
  const { user } = useAuth();
  const [elapsed, setElapsed] = useState('');
  const todayStr = new Date().toISOString().split('T')[0];

  // Live elapsed timer
  useEffect(() => {
    if (!jornadaActiva || !myJornada?.apertura_at) return;
    const update = () => {
      const diff = Date.now() - new Date(myJornada.apertura_at).getTime();
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setElapsed(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [jornadaActiva, myJornada?.apertura_at]);

  const entryTime = myJornada?.apertura_at
    ? new Date(myJornada.apertura_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  // Welcome message (shows once per jornada)
  const [welcomeMsg, setWelcomeMsg] = useState<{ text: string; icon: 'early' | 'ontime' | 'late' } | null>(null);
  const shownJornadaRef = useRef<string | null>(null);

  const { data: branchSchedule } = useQuery({
    queryKey: ['branch-schedule', branchId],
    queryFn: async () => {
      const { data } = await supabase
        .from('store_settings')
        .select('schedule')
        .eq('branch_id', branchId)
        .maybeSingle();
      return data?.schedule ?? null;
    },
    enabled: !!branchId,
    staleTime: Infinity,
  });

  useEffect(() => {
    if (!jornadaActiva || !myJornada?.id || !myJornada?.apertura_at || !branchSchedule) return;
    if (shownJornadaRef.current === myJornada.id) return;
    const storageKey = `welcome_shown_${myJornada.id}`;
    if (sessionStorage.getItem(storageKey)) {
      shownJornadaRef.current = myJornada.id;
      return;
    }
    const msg = getArrivalMessage(myJornada.apertura_at, branchSchedule);
    if (msg) {
      setWelcomeMsg(msg);
      shownJornadaRef.current = myJornada.id;
      sessionStorage.setItem(storageKey, '1');
      // Message stays visible permanently (no auto-dismiss)
    }
  }, [jornadaActiva, myJornada?.id, myJornada?.apertura_at, branchSchedule]);

  // Last 7 days sales
  const { data: weekSales = [] } = useQuery({
    queryKey: ['dashboard-week-sales', branchId, user?.id],
    queryFn: async () => {
      const days: { label: string; total: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = subDays(new Date(), i);
        const dayStr = format(d, 'yyyy-MM-dd');
        const { data } = await supabase
          .from('sales')
          .select('total')
          .eq('branch_id', branchId)
          .eq('user_id', user!.id)
          .eq('status', 'completed')
          .gte('created_at', dayStr + 'T00:00:00')
          .lte('created_at', dayStr + 'T23:59:59');
        const total = data?.reduce((s, r) => s + Number(r.total), 0) || 0;
        days.push({ label: format(d, 'EEE', { locale: es }), total });
      }
      return days;
    },
    enabled: !!branchId && !!user?.id && jornadaActiva,
    refetchInterval: 60000,
  });

  // Top 3 products sold today by this employee
  const { data: topProducts = [] } = useQuery({
    queryKey: ['dashboard-top-products', branchId, user?.id, todayStr],
    queryFn: async () => {
      const { data: sales } = await supabase
        .from('sales')
        .select('id')
        .eq('branch_id', branchId)
        .eq('user_id', user!.id)
        .eq('status', 'completed')
        .gte('created_at', todayStr + 'T00:00:00')
        .lte('created_at', todayStr + 'T23:59:59');
      if (!sales?.length) return [];
      const { data: items } = await supabase
        .from('sale_items')
        .select('product_id, quantity')
        .in('sale_id', sales.map(s => s.id));
      if (!items?.length) return [];

      const map: Record<string, number> = {};
      items.forEach(i => { map[i.product_id] = (map[i.product_id] || 0) + i.quantity; });
      const productIds = Object.keys(map);
      const { data: products } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds);
      const nameMap: Record<string, string> = {};
      products?.forEach(p => { nameMap[p.id] = p.name; });

      return Object.entries(map)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, qty]) => ({ name: nameMap[id] || 'Desconocido', quantity: qty }));
    },
    enabled: !!branchId && !!user?.id && jornadaActiva,
    refetchInterval: 30000,
  });

  // Week average for progress comparison
  const weekAvg = useMemo(() => {
    if (weekSales.length < 2) return 0;
    // Average of previous 6 days (excluding today)
    const prev = weekSales.slice(0, 6);
    const sum = prev.reduce((s, d) => s + d.total, 0);
    return prev.length > 0 ? sum / prev.length : 0;
  }, [weekSales]);

  const todayTotal = dailySalary.todayBranchSalesTotal + dailySalary.todayBranchServiceTotal + (dailySalary.todayPrintTotal || 0);
  const progressPct = weekAvg > 0 ? Math.min(100, Math.round((todayTotal / weekAvg) * 100)) : (todayTotal > 0 ? 100 : 0);

  const pieData = [
    { name: 'Productos', value: dailySalary.todayBranchSalesTotal, fill: 'hsl(var(--primary))' },
    { name: 'Servicios', value: dailySalary.todayBranchServiceTotal, fill: 'hsl(var(--accent))' },
    ...(dailySalary.todayPrintTotal > 0 ? [{ name: 'Impresiones', value: dailySalary.todayPrintTotal, fill: 'hsl(var(--chart-3))' }] : []),
  ].filter(d => d.value > 0);

  if (!jornadaActiva) {
    return (
      <div className="space-y-4">
        {businessId && (
          <EquipoActivoSection
            onlyActive
            businessIdOverride={businessId}
            myJornada={myJornada}
            jornadaActiva={jornadaActiva}
          />
        )}
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Clock className="h-10 w-10 opacity-40 mb-3" />
            <p className="text-sm font-medium">Sin jornada activa</p>
            <p className="text-xs mt-1">Inicia tu jornada para ver el dashboard en tiempo real.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Welcome message */}
      {welcomeMsg && (
        <div
          className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm animate-in fade-in slide-in-from-top-2 duration-500 ${
            welcomeMsg.icon === 'early'
              ? 'bg-primary/5 border-primary/20 text-primary'
              : welcomeMsg.icon === 'ontime'
              ? 'bg-warning/10 border-warning/30 text-warning-foreground'
              : 'bg-destructive/5 border-destructive/20 text-destructive'
          }`}
        >
          {welcomeMsg.icon === 'early' ? (
            <ThumbsUp className="h-5 w-5 flex-shrink-0 mt-0.5" />
          ) : welcomeMsg.icon === 'ontime' ? (
            <Sun className="h-5 w-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          )}
          <p className="leading-snug">{welcomeMsg.text}</p>
        </div>
      )}

      {/* Active team */}
      {businessId && (
        <EquipoActivoSection
          onlyActive
          businessIdOverride={businessId}
          myJornada={myJornada}
          jornadaActiva={jornadaActiva}
        />
      )}

      {/* Shift timer bar */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-2.5 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
              </span>
              <span className="text-sm font-semibold">Jornada activa</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Entrada: <strong className="text-foreground">{entryTime}</strong></span>
              <Badge variant="secondary" className="text-xs font-bold">{elapsed}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sales + Salary row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Sales */}
        <Card>
          <CardContent className="py-3 px-3">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
              <ShoppingCart className="h-3 w-3" /> Ventas del día
            </p>
            <p className="text-xl font-bold">${todayTotal.toLocaleString('es', { minimumFractionDigits: 2 })}</p>
            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground flex-wrap">
              <span className="flex items-center gap-0.5">
                <Package className="h-2.5 w-2.5" />
                ${dailySalary.todayBranchSalesTotal.toFixed(0)}
              </span>
              <span className="flex items-center gap-0.5">
                <Wrench className="h-2.5 w-2.5" />
                ${dailySalary.todayBranchServiceTotal.toFixed(0)}
              </span>
              {dailySalary.todayPrintTotal > 0 && (
                <span className="flex items-center gap-0.5">
                  <Printer className="h-2.5 w-2.5" />
                  ${dailySalary.todayPrintTotal.toFixed(0)}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Salary */}
        <Card className="border-primary/30">
          <CardContent className="py-3 px-3">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
              <DollarSign className="h-3 w-3" /> Salario estimado
            </p>
            <p className="text-xl font-bold text-primary">
              ${dailySalary.total.toLocaleString('es', { minimumFractionDigits: 2 })}
            </p>
            {!dailySalary.hasAssignment && (
              <p className="text-[10px] text-destructive mt-0.5 flex items-center gap-0.5">
                <AlertTriangle className="h-2.5 w-2.5" />
                Sin modalidad asignada
              </p>
            )}
            {dailySalary.hasAssignment && dailySalary.modalityName && (
              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {dailySalary.modalityName}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Salary breakdown */}
      {dailySalary.hasAssignment && (
        <Card>
          <CardContent className="py-3 px-4">
            <div className="space-y-1.5 text-xs">
              {dailySalary.base > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base diaria</span>
                  <span className="font-medium">${dailySalary.base.toFixed(2)}</span>
                </div>
              )}
              {dailySalary.serviceEarning > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    % Ingresos ({dailySalary.displayPercent}% ÷ {dailySalary.activeWorkersCount})
                  </span>
                  <span className="font-medium">${dailySalary.serviceEarning.toFixed(2)}</span>
                </div>
              )}
              {dailySalary.commissionEarning > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Comisiones</span>
                  <span className="font-medium">${dailySalary.commissionEarning.toFixed(2)}</span>
                </div>
              )}
              {dailySalary.tipShare > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Propinas</span>
                  <span className="font-medium">${dailySalary.tipShare.toFixed(2)}</span>
                </div>
              )}
              {dailySalary.total > 0 && (dailySalary.base > 0 || dailySalary.serviceEarning > 0) && (
                <div className="flex justify-between pt-1 border-t font-bold">
                  <span>Total</span>
                  <span className="text-primary">${dailySalary.total.toFixed(2)}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Day progress vs week average */}
      <Card>
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" /> Avance vs promedio semanal
            </p>
            <span className="text-xs font-bold">{progressPct}%</span>
          </div>
          <Progress value={progressPct} className="h-2.5" />
          <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
            <span>Hoy: ${todayTotal.toFixed(0)}</span>
            <span>Promedio: ${weekAvg.toFixed(0)}</span>
          </div>
        </CardContent>
      </Card>

      {/* 7-day sales chart */}
      {weekSales.length > 0 && (
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Ventas últimos 7 días
            </CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <div className="w-full h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weekSales} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 9 }} />
                  <Tooltip
                    contentStyle={{ ...rechartsTooltipStyle.contentStyle, fontSize: 11 }}
                    labelStyle={rechartsTooltipStyle.labelStyle}
                    itemStyle={rechartsTooltipStyle.itemStyle}
                    formatter={(value: number) => [`$${value.toFixed(0)}`, 'Ventas']}
                  />
                  <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                    {weekSales.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={idx === weekSales.length - 1 ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground) / 0.3)'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 3 products */}
      {topProducts.length > 0 && (
        <Card>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5" />
              Top productos de hoy
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className="space-y-2">
              {topProducts.map((p, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}.</span>
                    <span className="text-xs truncate max-w-[200px]">{p.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{p.quantity} uds</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Close shift button - single fixed bar */}
      <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-background border-t z-10">
        <Button
          className="w-full"
          variant="destructive"
          onClick={onOpenContarYCerrar}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {needsCount ? 'Contar y Cerrar Jornada' : 'Cerrar Jornada'}
        </Button>
      </div>
    </div>
  );
};

export default MyEmploymentDashboard;
