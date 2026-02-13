import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Store, Users, TrendingUp, CheckCircle, XCircle, Clock, ArrowRight, Package, ShoppingCart, Building2, DollarSign,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

const AdminDashboard = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: async () => {
      const [businesses, profiles, products, sales] = await Promise.all([
        supabase.from('businesses').select('id, name, subscription_status, created_at'),
        supabase.from('profiles').select('id'),
        supabase.from('products').select('id'),
        supabase.from('sales').select('id, total, status'),
      ]);

      const biz = businesses.data || [];
      const completedSales = (sales.data || []).filter(s => s.status === 'completed');
      const totalRevenue = completedSales.reduce((sum, s) => sum + Number(s.total), 0);

      return {
        businesses: biz,
        totalBusinesses: biz.length,
        activeBusinesses: biz.filter(b => b.subscription_status === 'active').length,
        pendingBusinesses: biz.filter(b => b.subscription_status === 'pending').length,
        suspendedBusinesses: biz.filter(b => b.subscription_status === 'suspended').length,
        totalUsers: (profiles.data || []).length,
        totalProducts: (products.data || []).length,
        totalSales: completedSales.length,
        totalRevenue,
        recentBusinesses: biz.slice(0, 5),
      };
    },
  });

  const stats = [
    { title: 'Total Negocios', value: data?.totalBusinesses || 0, icon: Store, color: 'bg-primary/10 text-primary' },
    { title: 'Activos', value: data?.activeBusinesses || 0, icon: CheckCircle, color: 'bg-success/10 text-success' },
    { title: 'Pendientes', value: data?.pendingBusinesses || 0, icon: Clock, color: 'bg-warning/10 text-warning' },
    { title: 'Suspendidos', value: data?.suspendedBusinesses || 0, icon: XCircle, color: 'bg-destructive/10 text-destructive' },
  ];

  const platformStats = [
    { title: 'Usuarios', value: data?.totalUsers || 0, icon: Users },
    { title: 'Productos', value: data?.totalProducts || 0, icon: Package },
    { title: 'Ventas', value: data?.totalSales || 0, icon: ShoppingCart },
    { title: 'Ingresos', value: `$${(data?.totalRevenue || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`, icon: DollarSign },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-success text-success-foreground">Activo</Badge>;
      case 'pending': return <Badge variant="secondary">Pendiente</Badge>;
      case 'suspended': return <Badge variant="destructive">Suspendido</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <AppLayout title="Panel de Super Admin">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Panel de Super Admin">
      <div className="space-y-6">
        {/* Business Status Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <div className="rounded-md p-2 bg-muted">
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Platform Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Métricas de la Plataforma
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {platformStats.map((stat) => (
                <div key={stat.title} className="flex items-center gap-3 rounded-lg border p-4">
                  <div className="rounded-md bg-muted p-2">
                    <stat.icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <p className="text-xl font-semibold">{stat.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Businesses + Quick Actions */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Negocios Recientes</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/businesses" className="gap-1">
                  Ver todos <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data?.recentBusinesses.map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                       <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
                         <Building2 className="h-4 w-4 text-muted-foreground" />
                       </div>
                      <div>
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(b.created_at).toLocaleDateString('es-ES')}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(b.subscription_status)}
                  </div>
                ))}
                {(!data?.recentBusinesses || data.recentBusinesses.length === 0) && (
                  <p className="py-4 text-center text-muted-foreground">No hay negocios registrados</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Acciones Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start gap-2" asChild>
                <Link to="/admin/businesses">
                  <Store className="h-4 w-4" />
                  Gestionar Negocios
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2" asChild>
                <Link to="/admin/stats">
                  <TrendingUp className="h-4 w-4" />
                  Ver Estadísticas
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start gap-2" asChild>
                <Link to="/employees">
                  <Users className="h-4 w-4" />
                  Gestionar Usuarios
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
