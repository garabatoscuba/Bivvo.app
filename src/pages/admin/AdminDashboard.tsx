import { useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Store, Users, TrendingUp, TrendingDown, Loader2,
  Building2, Zap, ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';

const PLAN_COLORS: Record<string, string> = {
  free: 'hsl(var(--muted-foreground))',
  professional: 'hsl(var(--primary) / 0.6)',
  enterprise: 'hsl(var(--primary))',
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito',
  professional: 'Profesional',
  enterprise: 'Enterprise',
};

const PLAN_PRICES: Record<string, number> = {
  free: 0,
  professional: 10,
  enterprise: 20,
};

const AdminDashboard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-overview-v2'],
    queryFn: async () => {
      const now = new Date();
      const thisMonthStart = startOfMonth(now);
      const thisMonthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));

      const [
        businessesRes,
        profilesRes,
        salesRes,
        modulesRes,
        bizTypeConfigsRes,
      ] = await Promise.all([
        supabase.from('businesses').select('id, name, owner_id, created_at, is_active').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email, plan_type'),
        supabase.from('sales').select('id, total, created_at, status'),
        supabase.from('platform_modules').select('id, name, sidebar_label, is_active'),
        supabase.from('business_type_configs').select('id, name, module_ids, is_active'),
      ]);

      const biz = businessesRes.data || [];
      const allProfiles = profilesRes.data || [];
      const completedSales = (salesRes.data || []).filter(s => s.status === 'completed');
      const modules = modulesRes.data || [];
      const bizTypeConfigs = bizTypeConfigsRes.data || [];

      // Active / Inactive
      const activeBiz = biz.filter(b => b.is_active);
      const inactiveBiz = biz.filter(b => !b.is_active);

      // New this month vs last month
      const newThisMonth = biz.filter(b => {
        const d = new Date(b.created_at);
        return d >= thisMonthStart && d <= thisMonthEnd;
      });
      const newLastMonth = biz.filter(b => {
        const d = new Date(b.created_at);
        return d >= lastMonthStart && d <= lastMonthEnd;
      });

      // Churn: businesses that became inactive this month (approximate: inactive + created before this month)
      // Since we don't track when is_active changed, we estimate: inactive businesses created before this month
      const churnThisMonth = inactiveBiz.filter(b => new Date(b.created_at) < thisMonthStart).length;
      const churnRate = biz.length > 0 ? Math.round((churnThisMonth / biz.length) * 100) : 0;

      // Top modules used across business_type_configs
      const moduleUsageCount: Record<string, number> = {};
      bizTypeConfigs.filter(c => c.is_active).forEach(config => {
        (config.module_ids || []).forEach((mId: string) => {
          moduleUsageCount[mId] = (moduleUsageCount[mId] || 0) + 1;
        });
      });
      const topModules = Object.entries(moduleUsageCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([id, count]) => {
          const mod = modules.find(m => m.id === id);
          return { name: mod?.sidebar_label || mod?.name || id, count };
        });

      // Plan distribution
      const planCounts: Record<string, number> = { free: 0, basic: 0, professional: 0 };
      allProfiles.forEach(p => {
        const plan = p.plan_type || 'free';
        if (plan in planCounts) planCounts[plan]++;
        else planCounts.free++;
      });
      const planDistribution = Object.entries(planCounts).map(([key, count]) => ({
        name: PLAN_LABELS[key] || key,
        value: count,
        revenue: count * (PLAN_PRICES[key] || 0),
        fill: PLAN_COLORS[key] || 'hsl(var(--muted-foreground))',
      }));

      // Monthly trend (last 6 months)
      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const label = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
        monthlyData.push({
          name: label,
          ingresos: completedSales
            .filter(s => { const sd = new Date(s.created_at); return sd >= d && sd <= mEnd; })
            .reduce((sum, s) => sum + Number(s.total), 0),
        });
      }

      // Recent businesses enriched
      const enrichedBiz = biz.slice(0, 5).map(b => {
        const owner = allProfiles.find(p => p.id === (b.owner_id ?? ''));
        return { ...b, owner_name: owner?.full_name || 'Sin dueño', owner_plan: owner?.plan_type || 'free' };
      });

      return {
        totalBusinesses: biz.length,
        activeBiz: activeBiz.length,
        inactiveBiz: inactiveBiz.length,
        activePercent: biz.length > 0 ? Math.round((activeBiz.length / biz.length) * 100) : 0,
        newThisMonth: newThisMonth.length,
        newLastMonth: newLastMonth.length,
        churnRate,
        churnThisMonth,
        topModules,
        planDistribution,
        monthlyData,
        recentBusinesses: enrichedBiz,
      };
    },
  });

  const newBizChange = useMemo(() => {
    if (!data) return 0;
    const prev = data.newLastMonth;
    const curr = data.newThisMonth;
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  }, [data]);

  if (isLoading) {
    return (
      <AppLayout title="Resumen">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const getPlanLabel = (plan: string | null) => {
    if (plan === 'professional') return 'Profesional';
    if (plan === 'basic') return 'Básico';
    return 'Gratuito';
  };

  const ChangeIndicator = ({ value }: { value: number }) => {
    if (value > 0) return <span className="flex items-center gap-0.5 text-[11px] font-medium text-emerald-600"><ArrowUpRight className="h-3 w-3" />+{value}%</span>;
    if (value < 0) return <span className="flex items-center gap-0.5 text-[11px] font-medium text-destructive"><ArrowDownRight className="h-3 w-3" />{value}%</span>;
    return <span className="flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground"><Minus className="h-3 w-3" />0%</span>;
  };

  return (
    <AppLayout title="Resumen">
      <div className="space-y-5">
        {/* KPI CARDS */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {/* Active vs Inactive */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Negocios</span>
                <Store className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <div className="text-xl font-semibold tracking-tight">{data?.totalBusinesses || 0}</div>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/40 text-emerald-600">
                  {data?.activeBiz || 0} activos ({data?.activePercent}%)
                </Badge>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/40 text-destructive">
                  {data?.inactiveBiz || 0} inactivos
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* New this month */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Nuevos este mes</span>
                <TrendingUp className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <div className="text-xl font-semibold tracking-tight">{data?.newThisMonth || 0}</div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <ChangeIndicator value={newBizChange} />
                <span className="text-[11px] text-muted-foreground">vs mes anterior ({data?.newLastMonth || 0})</span>
              </div>
            </CardContent>
          </Card>

          {/* Churn */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Tasa de Churn</span>
                <TrendingDown className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <div className="text-xl font-semibold tracking-tight">{data?.churnRate || 0}%</div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {data?.churnThisMonth || 0} negocio{(data?.churnThisMonth || 0) !== 1 ? 's' : ''} inactivo{(data?.churnThisMonth || 0) !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>

          {/* Top modules */}
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Módulos top</span>
                <Zap className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <div className="space-y-1.5">
                {(data?.topModules || []).length > 0 ? data?.topModules.map((m, i) => (
                  <div key={m.name} className="flex items-center justify-between">
                    <span className="text-xs truncate max-w-[140px]">
                      <span className="text-muted-foreground mr-1">{i + 1}.</span>
                      {m.name}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{m.count}</Badge>
                  </div>
                )) : <p className="text-xs text-muted-foreground">Sin datos</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CHARTS ROW */}
        <div className="grid gap-3 lg:grid-cols-2">
          {/* Revenue Trend (kept) */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Tendencia de Ingresos</CardTitle>
              <CardDescription className="text-xs">Últimos 6 meses</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={data?.monthlyData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    formatter={(v: number) => `$${v.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`}
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="ingresos" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.08)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Plan Distribution */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Distribución por Plan</CardTitle>
              <CardDescription className="text-xs">Negocios e ingresos estimados por plan</CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie
                      data={data?.planDistribution || []}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {(data?.planDistribution || []).map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, name: string) => [`${v} usuarios`, name]}
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-3">
                  {(data?.planDistribution || []).map((plan) => (
                    <div key={plan.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: plan.fill }} />
                        <span className="text-xs font-medium">{plan.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-semibold">{plan.value}</span>
                        <span className="text-[10px] text-muted-foreground ml-1.5">${plan.revenue}/mo</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Registrations (kept) */}
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Últimos Registros</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border/60">
              {data?.recentBusinesses?.map((b) => (
                <div key={b.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{b.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {b.owner_name} · {format(new Date(b.created_at), "d MMM yyyy", { locale: es })}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[11px] ml-2 shrink-0">
                    {getPlanLabel(b.owner_plan)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
