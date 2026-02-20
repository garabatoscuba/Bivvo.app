import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Store, Users, Package, ShoppingCart, TrendingUp, DollarSign, Building2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const AdminStats = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [businesses, profiles, products, sales, branches] = await Promise.all([
        supabase.from('businesses').select('id, created_at'),
        supabase.from('profiles').select('id'),
        supabase.from('products').select('id, sale_price, cost_price'),
        supabase.from('sales').select('id, total, created_at, status'),
        supabase.from('branches').select('id'),
      ]);

      const biz = businesses.data || [];
      const completedSales = (sales.data || []).filter(s => s.status === 'completed');
      const totalRevenue = completedSales.reduce((sum, s) => sum + Number(s.total), 0);

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
        totalProducts: (products.data || []).length,
        totalSales: completedSales.length,
        totalBranches: (branches.data || []).length,
        totalRevenue,
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
    { title: 'Total Negocios', value: stats?.totalBusinesses || 0, icon: Store },
    { title: 'Usuarios', value: stats?.totalUsers || 0, icon: Users },
    { title: 'Productos', value: stats?.totalProducts || 0, icon: Package },
    { title: 'Ventas Totales', value: stats?.totalSales || 0, icon: ShoppingCart },
    { title: 'Sucursales', value: stats?.totalBranches || 0, icon: Building2 },
    { title: 'Ingresos Totales', value: `$${(stats?.totalRevenue || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`, icon: DollarSign },
  ];

  return (
    <AppLayout title="Estadísticas de la Plataforma">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {summaryCards.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
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
      </div>
    </AppLayout>
  );
};

export default AdminStats;
