import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import {
  ShoppingCart,
  Package,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Users,
} from 'lucide-react';

const Dashboard = () => {
  const { profile, roles } = useAuth();

  const stats = [
    {
      title: 'Ventas Hoy',
      value: '$0.00',
      icon: ShoppingCart,
      change: '+0%',
      changeType: 'neutral' as const,
    },
    {
      title: 'Productos',
      value: '0',
      icon: Package,
      change: '0 en stock bajo',
      changeType: 'neutral' as const,
    },
    {
      title: 'Ingresos del Mes',
      value: '$0.00',
      icon: TrendingUp,
      change: '+0%',
      changeType: 'neutral' as const,
    },
    {
      title: 'Gastos del Mes',
      value: '$0.00',
      icon: DollarSign,
      change: '-0%',
      changeType: 'neutral' as const,
    },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Welcome Message */}
        <div className="rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 p-6">
          <h2 className="text-xl font-semibold text-foreground">
            ¡Bienvenido, {profile?.full_name?.split(' ')[0]}!
          </h2>
          <p className="mt-1 text-muted-foreground">
            {roles.length > 0 
              ? `Tu rol: ${roles.map(r => r.replace('_', ' ')).join(', ')}`
              : 'Comienza configurando tu negocio'
            }
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stat.change}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-category-green/20">
                <ShoppingCart className="h-6 w-6 text-category-green-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Punto de Venta</CardTitle>
                <p className="text-sm text-muted-foreground">Realizar una venta</p>
              </div>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-category-blue/20">
                <Package className="h-6 w-6 text-category-blue-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Inventario</CardTitle>
                <p className="text-sm text-muted-foreground">Gestionar productos</p>
              </div>
            </CardHeader>
          </Card>

          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardHeader className="flex flex-row items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-category-pink/20">
                <Users className="h-6 w-6 text-category-pink-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Empleados</CardTitle>
                <p className="text-sm text-muted-foreground">Gestionar equipo</p>
              </div>
            </CardHeader>
          </Card>
        </div>

        {/* Alerts Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No hay alertas en este momento. ¡Todo está funcionando correctamente!
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
