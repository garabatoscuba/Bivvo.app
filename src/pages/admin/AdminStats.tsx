import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Store, Users, Package, ShoppingCart, TrendingUp, DollarSign, Building2, CheckCircle, Clock, XCircle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['hsl(142, 71%, 45%)', 'hsl(38, 92%, 50%)', 'hsl(0, 84%, 60%)', 'hsl(220, 9%, 46%)'];

const AdminStats = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [businesses, profiles, products, sales, branches] = await Promise.all([
        supabase.from('businesses').select('id, subscription_status, created_at'),
        supabase.from('profiles').select('id'),
        supabase.from('products').select('id, sale_price, cost_price'),
        supabase.from('sales').select('id, total, created_at, status'),
        supabase.from('branches').select('id'),
      ]);

      const biz = businesses.data || [];
      const prods = products.data || [];
      const allSales = sales.data || [];
      const completedSales = allSales.filter(s => s.status === 'completed');

      const totalRevenue = completedSales.reduce((sum, s) => sum + Number(s.total), 0);

      const statusCounts = {
        active: biz.filter(b => b.subscription_status === 'active').length,
        pending: biz.filter(b => b.subscription_status === 'pending').length,
        suspended: biz.filter(b => b.subscription_status === 'suspended').length,
        cancelled: biz.filter(b => b.subscription_status === 'cancelled').length,
      };

      // Monthly registrations (last 6 months)
      const now = new Date();
      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const label = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
        const count = biz.filter(b => {
          const created = new Date(b.created_at);
          return created >= d && created <= monthEnd;
        }).length;
        monthlyData.push({ name: label, negocios: count });
      }

      return {
        totalBusinesses: biz.length,
        totalUsers: (profiles.data || []).length,
        totalProducts: prods.length,
        totalSales: completedSales.length,
        totalBranches: (branches.data || []).length,
        totalRevenue,
        statusCounts,
        monthlyData,
      };
    },
  });

  if (isLoading) {
    return (
      <AppLayout title="Estadísticas">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const summaryCards = [
    { title: 'Total Negocios', value: stats?.totalBusinesses || 0, icon: Store, color: 'bg-primary/10 text-primary' },
    { title: 'Usuarios', value: stats?.totalUsers || 0, icon: Users, color: 'bg-info/10 text-info' },
    { title: 'Productos', value: stats?.totalProducts || 0, icon: Package, color: 'bg-warning/10 text-warning' },
    { title: 'Ventas Totales', value: stats?.totalSales || 0, icon: ShoppingCart, color: 'bg-success/10 text-success' },
    { title: 'Sucursales', value: stats?.totalBranches || 0, icon: Building2, color: 'bg-accent-foreground/10 text-accent-foreground' },
    { title: 'Ingresos Totales', value: `$${(stats?.totalRevenue || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: 'bg-success/10 text-success' },
  ];

  const pieData = [
    { name: 'Activos', value: stats?.statusCounts.active || 0 },
    { name: 'Pendientes', value: stats?.statusCounts.pending || 0 },
    { name: 'Suspendidos', value: stats?.statusCounts.suspended || 0 },
    { name: 'Cancelados', value: stats?.statusCounts.cancelled || 0 },
  ].filter(d => d.value > 0);

  return (
    <AppLayout title="Estadísticas de la Plataforma">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summaryCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                 <div className="rounded-md p-2 bg-muted">
                   <stat.icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Monthly Registrations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Registros Mensuales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats?.monthlyData || []}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="negocios" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Distribución por Estado
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[280px] items-center justify-center text-muted-foreground">
                  No hay datos suficientes
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminStats;
