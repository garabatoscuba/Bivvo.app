import { useState, useMemo, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Store, Users, Package, ShoppingCart, DollarSign,
  BarChart3, Activity, Building2, Loader2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';

const AdminDashboard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => {
      const [businesses, profiles, products, sales, branches] = await Promise.all([
        supabase.from('businesses').select('id, name, owner_id, created_at').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email, plan_type'),
        supabase.from('products').select('id, business_id'),
        supabase.from('sales').select('id, total, created_at, status'),
        supabase.from('branches').select('id, business_id'),
      ]);

      const biz = businesses.data || [];
      const allProfiles = profiles.data || [];
      const completedSales = (sales.data || []).filter(s => s.status === 'completed');
      const totalRevenue = completedSales.reduce((sum, s) => sum + Number(s.total), 0);

      const now = new Date();
      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const label = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
        monthlyData.push({
          name: label,
          negocios: biz.filter(b => new Date(b.created_at) >= d && new Date(b.created_at) <= monthEnd).length,
          ventas: completedSales.filter(s => new Date(s.created_at) >= d && new Date(s.created_at) <= monthEnd).length,
          ingresos: completedSales.filter(s => new Date(s.created_at) >= d && new Date(s.created_at) <= monthEnd).reduce((sum, s) => sum + Number(s.total), 0),
        });
      }

      const enrichedBiz = biz.slice(0, 5).map(b => {
        const owner = allProfiles.find(p => p.id === (b.owner_id ?? ''));
        return { ...b, owner_name: owner?.full_name || 'Sin dueño', owner_plan: owner?.plan_type || 'free' };
      });

      return {
        totalBusinesses: biz.length,
        totalUsers: allProfiles.length,
        totalProducts: (products.data || []).length,
        totalSales: completedSales.length,
        totalBranches: (branches.data || []).length,
        totalRevenue,
        monthlyData,
        recentBusinesses: enrichedBiz,
      };
    },
  });

  if (isLoading) {
    return (
      <AppLayout title="Resumen">
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  const getPlanLabel = (plan: string | null) => {
    if (plan === 'professional') return 'Profesional';
    if (plan === 'basic') return 'Básico';
    return 'Gratuito';
  };

  const kpiItems = [
    { title: 'Negocios', value: data?.totalBusinesses || 0, icon: Store, sub: 'registrados' },
    { title: 'Usuarios', value: data?.totalUsers || 0, icon: Users, sub: 'registrados' },
    { title: 'Ventas', value: data?.totalSales || 0, icon: ShoppingCart, sub: 'completadas' },
    { title: 'Ingresos', value: `$${(data?.totalRevenue || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`, icon: DollarSign, sub: 'total facturado' },
  ];

  return (
    <AppLayout title="Resumen">
      <div className="space-y-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <div className="overflow-x-auto">
            <TabsList className="bg-muted/60">
              <TabsTrigger value="overview" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" /> Resumen</TabsTrigger>
              <TabsTrigger value="stats" className="gap-1.5 text-xs"><BarChart3 className="h-3.5 w-3.5" /> Estadísticas</TabsTrigger>
            </TabsList>
          </div>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-5 mt-0">
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              {kpiItems.map((stat) => (
                <Card key={stat.title} className="border-border/60">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{stat.title}</span>
                      <stat.icon className="h-4 w-4 text-muted-foreground/60" />
                    </div>
                    <div className="text-xl font-semibold tracking-tight">{stat.value}</div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{stat.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Tendencia de Ingresos</CardTitle>
                <CardDescription className="text-xs">Últimos 6 meses</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={data?.monthlyData || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip formatter={(v: number) => `$${v.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="ingresos" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.08)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Últimos Registros</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <div className="divide-y divide-border/60">
                  {data?.recentBusinesses?.map((b) => (
                    <div key={b.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{b.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{b.owner_name} · {format(new Date(b.created_at), "d MMM yyyy", { locale: es })}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[11px] ml-2 shrink-0">{getPlanLabel(b.owner_plan)}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* STATS */}
          <TabsContent value="stats" className="space-y-5 mt-0">
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
              {[
                { title: 'Negocios', value: data?.totalBusinesses || 0, icon: Store },
                { title: 'Usuarios', value: data?.totalUsers || 0, icon: Users },
                { title: 'Productos', value: data?.totalProducts || 0, icon: Package },
                { title: 'Ventas', value: data?.totalSales || 0, icon: ShoppingCart },
                { title: 'Sucursales', value: data?.totalBranches || 0, icon: Building2 },
                { title: 'Ingresos', value: `$${(data?.totalRevenue || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`, icon: DollarSign },
              ].map((stat) => (
                <Card key={stat.title} className="border-border/60">
                  <CardContent className="p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                      <stat.icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <span className="text-[11px] font-medium text-muted-foreground">{stat.title}</span>
                    </div>
                    <div className="text-lg font-semibold tracking-tight">{stat.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="border-border/60">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Registros y Ventas Mensuales</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data?.monthlyData || []} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' }} />
                    <Bar dataKey="negocios" name="Negocios" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="ventas" name="Ventas" fill="hsl(var(--primary) / 0.6)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
