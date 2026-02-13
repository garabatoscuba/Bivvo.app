import { Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts, useBranchStock } from '@/hooks/useProducts';
import { useBranches } from '@/hooks/useBranches';
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
  const { products } = useProducts();
  const { data: branches } = useBranches();
  const currentBranch = profile?.branch_id || branches?.[0]?.id;
  const { data: branchStock } = useBranchStock(currentBranch);

  // Calcular alertas de stock bajo
  const lowStockProducts = branchStock?.filter((bs: any) => {
    const product = products.find(p => p.id === bs.product_id);
    return product && bs.quantity <= product.min_stock && bs.quantity > 0;
  }) || [];

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
      value: products.length.toString(),
      icon: Package,
      change: `${lowStockProducts.length} en stock bajo`,
      changeType: lowStockProducts.length > 0 ? 'warning' : 'neutral' as const,
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
        <div className="py-2">
          <h2 className="text-lg font-semibold text-foreground">
            ¡Bienvenido, {profile?.full_name?.split(' ')[0]}!
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
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
                <p className={`mt-1 text-xs ${stat.changeType === 'warning' ? 'text-warning' : 'text-muted-foreground'}`}>
                  {stat.change}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Link to="/pos">
            <Card className="cursor-pointer transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center gap-4">
                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Punto de Venta</CardTitle>
                  <p className="text-sm text-muted-foreground">Realizar una venta</p>
                </div>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/inventory">
            <Card className="cursor-pointer transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center gap-4">
                <Package className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Inventario</CardTitle>
                  <p className="text-sm text-muted-foreground">Gestionar productos</p>
                </div>
              </CardHeader>
            </Card>
          </Link>

          <Link to="/employees">
            <Card className="cursor-pointer transition-colors hover:bg-muted/50">
              <CardHeader className="flex flex-row items-center gap-4">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">Empleados</CardTitle>
                  <p className="text-sm text-muted-foreground">Gestionar equipo</p>
                </div>
              </CardHeader>
            </Card>
          </Link>
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
            {lowStockProducts.length > 0 ? (
              <div className="space-y-2">
                {lowStockProducts.slice(0, 5).map((bs: any) => {
                  const product = products.find(p => p.id === bs.product_id);
                  return product ? (
                    <div key={bs.id} className="flex items-center justify-between rounded-lg bg-warning/10 p-3">
                      <span className="font-medium">{product.name}</span>
                      <span className="text-sm text-warning">
                        Stock: {bs.quantity} (mín: {product.min_stock})
                      </span>
                    </div>
                  ) : null;
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No hay alertas en este momento. ¡Todo está funcionando correctamente!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
