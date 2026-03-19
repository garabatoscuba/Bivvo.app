import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts, useBranchStock } from '@/hooks/useProducts';
import { useBranches } from '@/hooks/useBranches';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { PeriodFilter, type Period } from '@/components/ui/period-filter';
import { useSubscription } from '@/hooks/useSubscription';
import { useRawMaterials } from '@/hooks/usePrintData';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
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
  ArrowUpRight, ArrowDownRight, Minus } from
'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import PerformanceWidget from '@/components/dashboard/PerformanceWidget';
import OwnerFinancialCards from '@/components/dashboard/OwnerFinancialCards';
import EquipoActivoSection from '@/components/employees/EquipoActivoSection';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';


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
  const { profile, roles, isAffiliated, isOwner, isManager, isSuperAdmin, isBivooAccount } = useAuth();
  const { products } = useProducts();
  const { data: branches } = useBranches();
  const currentBranch = profile?.branch_id || branches?.[0]?.id;
  const { data: branchStock } = useBranchStock(currentBranch);
  const { planType, status: subStatus, totalMonthly } = useSubscription();

  const navigate = useNavigate();
  const isEmployee = !isOwner && !isManager && !isSuperAdmin;

  // Redirect employees to Mi Empleo — they don't see the owner dashboard
  useEffect(() => {
    if (isEmployee || isBivooAccount) {
      navigate('/mi-empleo', { replace: true });
    }
  }, [isEmployee, isBivooAccount, navigate]);

  const [period, setPeriod] = useState<Period>('today');
  const [planInfoPopupOpen, setPlanInfoPopupOpen] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const { data: stats, isLoading } = useDashboardStats(currentBranch, period);

  // Show welcome dialog for first-time OWNER users only (never for employees)
  useEffect(() => {
    if (!profile?.user_id) return;
    if (isEmployee || isBivooAccount) return; // Skip onboarding for employees
    if (!profile.country || !(profile as any).onboarding_completed) {
      setShowWelcome(true);
    }
  }, [profile?.user_id, profile?.country, (profile as any)?.onboarding_completed, isEmployee, isBivooAccount]);

  const planNoticeStorageKey = profile?.user_id ? `bivoo-plan-notice-${profile.user_id}` : null;
  const planNoticeValue = `${planType}:${profile?.subscription_status || 'none'}`;

  // Show info-only popup when a paid plan becomes active (without asking business name/type again)
  useEffect(() => {
    if (!planNoticeStorageKey) return;
    if (isEmployee || isBivooAccount) return;
    if (planType === 'free' || subStatus === 'blocked') return;

    const alreadySeen = localStorage.getItem(planNoticeStorageKey);
    if (alreadySeen !== planNoticeValue) {
      setPlanInfoPopupOpen(true);
    }
  }, [
    planNoticeStorageKey,
    planNoticeValue,
    planType,
    subStatus,
    isEmployee,
    isBivooAccount,
  ]);

  const handleClosePlanInfo = () => {
    if (planNoticeStorageKey) {
      localStorage.setItem(planNoticeStorageKey, planNoticeValue);
    }
    setPlanInfoPopupOpen(false);
  };

  const planLabel = planType === 'professional' ? 'Profesional' : planType === 'basic' ? 'Básico' : 'Gratuito';

  const lowStockProducts = branchStock?.filter((bs: any) => {
    const product = products.find((p) => p.id === bs.product_id);
    return product && bs.quantity <= product.min_stock && bs.quantity > 0;
  }) || [];

  // Low stock for raw materials (Impresiones)
  const { data: rawMaterials = [] } = useRawMaterials();
  const lowStockMaterials = rawMaterials.filter((m: any) => {
    const totalStock = (m.stock_almacen || 0) + (m.stock_vendedor || 0);
    return m.stock_minimo > 0 && totalStock <= m.stock_minimo && totalStock >= 0;
  });

  const hasAlerts = lowStockProducts.length > 0 || lowStockMaterials.length > 0;

  const areaChartConfig = {
    total: { label: 'Ventas', color: 'hsl(var(--chart-1))' }
  };

  const pieChartConfig = Object.fromEntries(
    (stats?.paymentMethods || []).map((pm) => [pm.name, { label: pm.name, color: pm.fill }])
  );

  const barChartConfig = {
    quantity: { label: 'Cantidad', color: 'hsl(var(--chart-2))' }
  };

  // Affiliated users see a special welcome screen
  if (isAffiliated) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-6">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              ¡Hola, {profile?.full_name?.split(' ')[0]}!
            </h1>
            <p className="text-muted-foreground max-w-md">
              Actualmente eres cliente afiliado. Puedes acumular puntos en las tiendas donde te has registrado.
            </p>
          </div>
          <Card className="max-w-sm w-full">
            <CardHeader className="text-center">
              <CardTitle className="text-lg">¿Tienes un negocio?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Gestiona tu inventario, ventas, empleados y más desde un solo lugar con GestorPro.
              </p>
              <Link to="/plans">
                <DialogButton className="w-full">
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Crear mi negocio
                </DialogButton>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

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
          <PeriodFilter value={period} onChange={setPeriod} className="w-full sm:w-auto" />
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
            {hasAlerts ?
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
                {lowStockMaterials.slice(0, 5).map((m: any) => {
                  const totalStock = (m.stock_almacen || 0) + (m.stock_vendedor || 0);
                  return (
                    <div key={m.id} className="flex items-center justify-between rounded-lg bg-warning/10 p-3">
                      <span className="font-medium">🖨️ {m.name}</span>
                      <span className="text-sm text-warning">
                        Stock: {totalStock} (mín: {m.stock_minimo})
                      </span>
                    </div>
                  );
                })}
              </div> :
            <p className="text-sm text-muted-foreground">
                No hay alertas en este momento. ¡Todo está funcionando correctamente!
              </p>
            }
          </CardContent>
        </Card>

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

        {/* Owner Financial Cards */}
        {isOwner && profile?.business_id && (
          <OwnerFinancialCards
            businessId={profile.business_id}
            branchId={currentBranch}
            period={period}
          />
        )}

        {/* Equipo activo ahora */}
        {(isOwner || isManager) && profile?.business_id && (
          <EquipoActivoSection
            onlyActive
            businessIdOverride={profile.business_id}
          />
        )}

        <div className="grid gap-3 md:gap-4 lg:grid-cols-3 border-transparent">
          {/* Sales over time */}
          <Card className="lg:col-span-2 max-w-full overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Ventas por Período</CardTitle>
            </CardHeader>
            <CardContent className="w-full overflow-hidden">
              {isLoading ?
              <Skeleton className="h-[180px] md:h-[250px] w-full" /> :

              <ChartContainer config={areaChartConfig} className="h-[180px] md:h-[250px] w-full" style={{ minWidth: 0 }}>
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
          <Card className="max-w-full overflow-hidden">
            <CardHeader>
              <CardTitle className="text-base">Métodos de Pago</CardTitle>
            </CardHeader>
            <CardContent className="w-full overflow-hidden">
              {isLoading ?
              <Skeleton className="h-[180px] md:h-[250px] w-full" /> :
              (stats?.paymentMethods?.length || 0) === 0 ?
              <div className="flex h-[180px] md:h-[250px] items-center justify-center text-sm text-muted-foreground">
                  Sin datos en este período
                </div> :

              <ChartContainer config={pieChartConfig} className="h-[180px] md:h-[250px] w-full mx-auto max-w-[300px]">
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

        {/* Performance Widget */}
        <PerformanceWidget />


      </div>

      {/* Onboarding Wizard for first-time users */}
      {showWelcome && profile && (
        <OnboardingWizard
          open={showWelcome}
          profile={{
            user_id: profile.user_id,
            business_id: profile.business_id,
            country: profile.country,
          }}
        />
      )}

      {/* Estudio Garabatos promo */}
      <Card className="border-amber-500/30 bg-gradient-to-br from-card to-amber-950/10">
        <CardContent className="flex flex-col sm:flex-row items-center gap-4 p-5">
          <img
            src="https://estudiogarabatos.com/logo-completo-blanco.png"
            alt="Estudio Garabatos"
            className="h-14 w-auto object-contain shrink-0"
          />
          <div className="flex-1 text-center sm:text-left space-y-1">
            <p className="text-sm font-semibold text-foreground">¿Tu negocio necesita una identidad visual?</p>
            <p className="text-xs text-muted-foreground">Diseño de logos, branding completo y portales web personalizados, fotografía, estrategias y mucho más. El estudio detrás de Bivoo.</p>
          </div>
          <DialogButton
            variant="outline"
            size="sm"
            className="border-amber-500/40 hover:bg-amber-500/10 shrink-0"
            onClick={() => window.open('https://estudiogarabatos.com', '_blank')}
          >
            Conocer Estudio Garabatos
          </DialogButton>
        </CardContent>
      </Card>

      {/* Plan activated info popup */}
      <Dialog
        open={planInfoPopupOpen}
        onOpenChange={(open) => {
          if (open) {
            setPlanInfoPopupOpen(true);
          } else {
            handleClosePlanInfo();
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>🎉 ¡Tu plan está activo!</DialogTitle>
            <DialogDescription>
              Conservamos el nombre y el tipo de negocio que configuraste en tus primeros pasos.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium">{planLabel}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Estado</span>
              <span className="font-medium">{subStatus === 'trial' ? 'Prueba activa' : 'Activo'}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total mensual</span>
              <span className="font-medium">${totalMonthly} USD</span>
            </div>
          </div>

          <DialogFooter>
            <DialogButton className="w-full" onClick={handleClosePlanInfo}>
              Entendido
            </DialogButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>);

};

export default Dashboard;