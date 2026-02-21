import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts, useBranchStock } from '@/hooks/useProducts';
import { useBranches } from '@/hooks/useBranches';
import { useDashboardStats, type Period } from '@/hooks/useDashboardStats';
import { useSubscription } from '@/hooks/useSubscription';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button as DialogButton } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  PieChart, Pie, Cell,
  BarChart, Bar, ResponsiveContainer } from
'recharts';
import {
  ShoppingCart, Package, TrendingUp, AlertTriangle,
  Users, DollarSign, Hash, CreditCard,
  Calendar, CalendarDays, CalendarRange, CalendarClock,
  ArrowUpRight, ArrowDownRight, Minus } from
'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const PERIOD_OPTIONS: {value: Period;label: string;icon: typeof Calendar;}[] = [
{ value: 'today', label: 'Hoy', icon: Calendar },
{ value: 'week', label: 'Semana', icon: CalendarDays },
{ value: 'month', label: 'Mes', icon: CalendarRange },
{ value: 'year', label: 'Año', icon: CalendarClock }];

const formatCurrency = (n: number) =>
new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

const ChangeIndicator = ({ value }: {value: number;}) => {
  if (value > 0)
  return (
    <span className="flex items-center gap-0.5 text-xs text-success">
        <ArrowUpRight className="h-3 w-3" />+{value}%
      </span>);

  if (value < 0)
  return (
    <span className="flex items-center gap-0.5 text-xs text-destructive">
        <ArrowDownRight className="h-3 w-3" />{value}%
      </span>);

  return (
    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
      <Minus className="h-3 w-3" />0%
    </span>);

};

const Dashboard = () => {
  const { profile, roles } = useAuth();
  const { products } = useProducts();
  const { data: branches } = useBranches();
  const currentBranch = profile?.branch_id || branches?.[0]?.id;
  const { data: branchStock } = useBranchStock(currentBranch);
  const { planType, status: subStatus } = useSubscription();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('today');
  const [newPlanPopup, setNewPlanPopup] = useState(false);
  const [newBizName, setNewBizName] = useState('');
  const [creatingBiz, setCreatingBiz] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const { data: stats, isLoading } = useDashboardStats(currentBranch, period);

  // Show welcome dialog for first-time users
  useEffect(() => {
    if (!profile?.user_id) return;
    const key = `welcome_shown_${profile.user_id}`;
    if (!localStorage.getItem(key)) {
      setShowWelcome(true);
      localStorage.setItem(key, 'true');
    }
  }, [profile?.user_id]);

  // Show popup reactively when plan changes from free to paid/trial
  useEffect(() => {
    const checkBizName = async () => {
      if (!profile?.business_id || planType === 'free') return;
      if (subStatus === 'blocked') return;
      const { data } = await supabase
        .from('businesses')
        .select('name')
        .eq('id', profile.business_id)
        .single();
      if (data?.name === 'Negocio de prueba') {
        setNewPlanPopup(true);
      }
    };
    checkBizName();
  }, [profile?.business_id, planType, subStatus]);

  const handleCreateAndReplace = async () => {
    if (!newBizName.trim() || !profile?.business_id) return;
    setCreatingBiz(true);
    try {
      // Create new business via edge function
      const { data, error } = await supabase.functions.invoke('create-business', {
        body: { name: newBizName.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Delete the old trial business if it's empty (no products, no sales)
      const oldBizId = profile.business_id;
      const { count: productCount } = await supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', oldBizId);
      const trialBizBranches = await supabase
        .from('branches')
        .select('id')
        .eq('business_id', oldBizId);
      const branchIds = trialBizBranches.data?.map(b => b.id) || [];
      let saleCount = 0;
      if (branchIds.length > 0) {
        const { count } = await supabase
          .from('sales')
          .select('id', { count: 'exact', head: true })
          .in('branch_id', branchIds);
        saleCount = count || 0;
      }

      if ((productCount || 0) === 0 && saleCount === 0) {
        await supabase.from('businesses').delete().eq('id', oldBizId);
      }

      toast({ title: '¡Negocio creado!', description: `${newBizName.trim()} está listo.` });
      setNewPlanPopup(false);
      queryClient.invalidateQueries({ queryKey: ['user-businesses-with-branches'] });
      window.location.reload();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setCreatingBiz(false);
    }
  };

  const lowStockProducts = branchStock?.filter((bs: any) => {
    const product = products.find((p) => p.id === bs.product_id);
    return product && bs.quantity <= product.min_stock && bs.quantity > 0;
  }) || [];

  const areaChartConfig = {
    total: { label: 'Ventas', color: 'hsl(var(--chart-1))' }
  };

  const pieChartConfig = Object.fromEntries(
    (stats?.paymentMethods || []).map((pm) => [pm.name, { label: pm.name, color: pm.fill }])
  );

  const barChartConfig = {
    quantity: { label: 'Cantidad', color: 'hsl(var(--chart-2))' }
  };

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6 border-transparent border-2">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="hidden md:block">
            <h2 className="text-lg font-semibold text-foreground">
              ¡Bienvenido, {profile?.full_name?.split(' ')[0]}!
            </h2>
            <p className="text-sm text-muted-foreground">
              {roles.length > 0 ?
              `Tu rol: ${roles.map((r) => r.replace('_', ' ')).join(', ')}` :
              'Comienza configurando tu negocio'}
            </p>
          </div>
          <ToggleGroup
            type="single"
            value={period}
            onValueChange={(v) => v && setPeriod(v as Period)}
            className="border border-border bg-card w-full sm:w-auto">

            {PERIOD_OPTIONS.map((opt) =>
            <ToggleGroupItem key={opt.value} value={opt.value} className="gap-1 text-xs px-2.5 flex-1 sm:flex-none sm:px-3">
                <opt.icon className="h-3.5 w-3.5" />
                {opt.label}
              </ToggleGroupItem>
            )}
          </ToggleGroup>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
          {
            title: 'Total Ventas',
            value: isLoading ? null : formatCurrency(stats?.totalSales || 0),
            change: stats?.totalSalesChange || 0,
            icon: DollarSign
          },
          {
            title: 'Transacciones',
            value: isLoading ? null : (stats?.salesCount || 0).toString(),
            change: stats?.salesCountChange || 0,
            icon: Hash
          },
          {
            title: 'Ticket Prom.',
            value: isLoading ? null : formatCurrency(stats?.avgTicket || 0),
            change: stats?.avgTicketChange || 0,
            icon: TrendingUp
          },
          {
            title: 'Por Cobrar',
            value: isLoading ? null : formatCurrency(stats?.pendingCredit || 0),
            change: null,
            icon: CreditCard
          }].
          map((kpi) =>
          <Card key={kpi.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-1 md:pb-2 p-3 md:p-6 md:pt-6">
                <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                <kpi.icon className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
                {kpi.value === null ?
              <Skeleton className="h-7 w-20 md:h-8 md:w-24" /> :

              <div className="text-lg md:text-2xl font-bold">{kpi.value}</div>
              }
                {kpi.change !== null && !isLoading && <ChangeIndicator value={kpi.change} />}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Charts Row */}
        <div className="grid gap-3 md:gap-4 lg:grid-cols-3 border-transparent">
          {/* Sales over time */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Ventas por Período</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ?
              <Skeleton className="h-[180px] md:h-[250px] w-full" /> :

              <ChartContainer config={areaChartConfig} className="h-[180px] md:h-[250px] w-full">
                  <AreaChart data={stats?.salesOverTime || []}>
                    <defs>
                      <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={(v) => `$${v}`} />
                    <ChartTooltip
                    content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />

                    <Area
                    type="monotone"
                    dataKey="total"
                    stroke="hsl(var(--chart-1))"
                    fill="url(#fillTotal)"
                    strokeWidth={2} />

                  </AreaChart>
                </ChartContainer>
              }
            </CardContent>
          </Card>

          {/* Payment methods donut */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Métodos de Pago</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ?
              <Skeleton className="h-[180px] md:h-[250px] w-full" /> :
              (stats?.paymentMethods?.length || 0) === 0 ?
              <div className="flex h-[180px] md:h-[250px] items-center justify-center text-sm text-muted-foreground">
                  Sin datos en este período
                </div> :

              <ChartContainer config={pieChartConfig} className="h-[180px] md:h-[250px] w-full">
                  <PieChart>
                    <ChartTooltip
                    content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />

                    <Pie
                    data={stats?.paymentMethods}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}>

                      {stats?.paymentMethods.map((entry, i) =>
                    <Cell key={i} fill={entry.fill} />
                    )}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              }
              {/* Legend */}
              {(stats?.paymentMethods?.length || 0) > 0 &&
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                  {stats?.paymentMethods.map((pm) =>
                <div key={pm.name} className="flex items-center gap-1.5 text-xs">
                      <div className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: pm.fill }} />
                      <span className="text-muted-foreground">{pm.name}</span>
                    </div>
                )}
                </div>
              }
            </CardContent>
          </Card>
        </div>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 5 Productos Más Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ?
            <Skeleton className="h-[160px] md:h-[200px] w-full" /> :
            (stats?.topProducts?.length || 0) === 0 ?
            <p className="text-sm text-muted-foreground">Sin ventas en este período</p> :

            <ChartContainer config={barChartConfig} className="h-[160px] md:h-[200px] w-full">
                <BarChart data={stats?.topProducts} layout="vertical">
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  fontSize={11}
                  width={120} />

                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="quantity" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ChartContainer>
            }
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-2 md:gap-4 md:grid-cols-3">
          {[
          { to: '/pos', icon: ShoppingCart, title: 'POS', desc: 'Realizar venta' },
          { to: '/inventory', icon: Package, title: 'Inventario', desc: 'Gestionar productos' },
          { to: '/employees', icon: Users, title: 'Empleados', desc: 'Gestionar equipo' }].
          map((action) =>
          <Link key={action.to} to={action.to}>
              <Card className="cursor-pointer transition-colors hover:bg-muted/50">
                <CardHeader className="flex flex-col items-center gap-1.5 p-3 md:flex-row md:gap-4 md:p-6">
                  <action.icon className="h-5 w-5 text-muted-foreground" />
                  <div className="text-center md:text-left">
                    <CardTitle className="text-sm md:text-base">{action.title}</CardTitle>
                    <p className="text-xs text-muted-foreground hidden md:block">{action.desc}</p>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          )}
        </div>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length > 0 ?
            <div className="space-y-2">
                {lowStockProducts.slice(0, 5).map((bs: any) => {
                const product = products.find((p) => p.id === bs.product_id);
                return product ?
                <div key={bs.id} className="flex items-center justify-between rounded-lg bg-warning/10 p-3">
                      <span className="font-medium">{product.name}</span>
                      <span className="text-sm text-warning">
                        Stock: {bs.quantity} (mín: {product.min_stock})
                      </span>
                    </div> :
                null;
              })}
              </div> :

            <p className="text-sm text-muted-foreground">
                No hay alertas en este momento. ¡Todo está funcionando correctamente!
              </p>
            }
          </CardContent>
        </Card>
      </div>

      {/* Welcome Dialog for first-time users */}
      <Dialog open={showWelcome} onOpenChange={setShowWelcome}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">🎉 ¡Bienvenido a GestorPro!</DialogTitle>
            <DialogDescription className="text-base pt-2">
              Tu herramienta todo-en-uno para gestionar tu negocio de forma simple y eficiente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <p className="text-sm font-medium">Primeros pasos:</p>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>📦 Agrega tus productos desde <strong>Inventario</strong></li>
                <li>🛒 Realiza tu primera venta en el <strong>Punto de Venta</strong></li>
                <li>📊 Consulta tus métricas en el <strong>Dashboard</strong></li>
                <li>⚙️ Personaliza tu negocio en <strong>Ajustes</strong></li>
              </ol>
            </div>
            <p className="text-xs text-muted-foreground">
              Empiezas con un plan gratuito. Puedes probar planes superiores por 7 días sin compromiso desde la sección de <strong>Planes</strong>.
            </p>
          </div>
          <DialogFooter>
            <DialogButton className="w-full" onClick={() => setShowWelcome(false)}>
              ¡Empezar!
            </DialogButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Plan — Create Business Popup */}
      <Dialog open={newPlanPopup} onOpenChange={setNewPlanPopup}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>🎉 ¡Tu plan está activo!</DialogTitle>
            <DialogDescription>
              Escribe el nombre de tu negocio real. El negocio de prueba se eliminará automáticamente si está vacío.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="Ej: Mi Tienda, Ferretería López..."
              value={newBizName}
              onChange={(e) => setNewBizName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateAndReplace()}
            />
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <DialogButton
              className="w-full"
              onClick={handleCreateAndReplace}
              disabled={!newBizName.trim() || creatingBiz}
            >
              {creatingBiz ? 'Creando...' : 'Crear negocio'}
            </DialogButton>
            <DialogButton variant="ghost" className="w-full" onClick={() => setNewPlanPopup(false)}>
              Después
            </DialogButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>);

};

export default Dashboard;