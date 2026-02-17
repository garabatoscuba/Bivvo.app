import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Store, Plus, CheckCircle, XCircle, Clock, Ban, Search, Loader2, Building2,
  Settings, Users, Package, ShoppingCart, TrendingUp, DollarSign, ArrowRight, Crown,
  CalendarDays, AlertTriangle,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';

type SubscriptionStatus = Database['public']['Enums']['subscription_status'];

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle }> = {
  active: { label: 'Activo', variant: 'default', icon: CheckCircle },
  pending: { label: 'Pendiente', variant: 'secondary', icon: Clock },
  suspended: { label: 'Suspendido', variant: 'destructive', icon: XCircle },
  cancelled: { label: 'Cancelado', variant: 'outline', icon: Ban },
};

const COLORS = ['hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--muted))'];

interface ManageData {
  id: string;
  name: string;
  plan_type: string;
  subscription_status: SubscriptionStatus;
  subscription_ends_at: string;
  max_branches: number;
}

const AdminDashboard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [manageData, setManageData] = useState<ManageData | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [newBusiness, setNewBusiness] = useState({ name: '' });

  // Unified query for all admin data
  const { data, isLoading } = useQuery({
    queryKey: ['admin-all-data'],
    queryFn: async () => {
      const [businesses, profiles, products, sales, branches] = await Promise.all([
        supabase.from('businesses').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email, business_id'),
        supabase.from('products').select('id, business_id'),
        supabase.from('sales').select('id, total, created_at, status, branch_id'),
        supabase.from('branches').select('id, business_id'),
      ]);

      const biz = businesses.data || [];
      const allProfiles = profiles.data || [];
      const allProducts = products.data || [];
      const allSales = sales.data || [];
      const allBranches = branches.data || [];
      const completedSales = allSales.filter(s => s.status === 'completed');
      const totalRevenue = completedSales.reduce((sum, s) => sum + Number(s.total), 0);

      // Enrich businesses
      const enriched = biz.map(b => {
        const owner = allProfiles.find(p => p.id === (b.owner_id ?? ''));
        const branchCount = allBranches.filter(br => br.business_id === b.id).length;
        const productCount = allProducts.filter(p => p.business_id === b.id).length;

        return {
          ...b,
          owner_name: owner?.full_name || 'Sin dueño',
          owner_email: owner?.email || '',
          branch_count: branchCount,
          product_count: productCount,
        };
      });

      // Status counts
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
        const bizCount = biz.filter(b => {
          const created = new Date(b.created_at);
          return created >= d && created <= monthEnd;
        }).length;
        const salesCount = completedSales.filter(s => {
          const created = new Date(s.created_at);
          return created >= d && created <= monthEnd;
        }).length;
        const revenue = completedSales
          .filter(s => {
            const created = new Date(s.created_at);
            return created >= d && created <= monthEnd;
          })
          .reduce((sum, s) => sum + Number(s.total), 0);
        monthlyData.push({ name: label, negocios: bizCount, ventas: salesCount, ingresos: revenue });
      }

      // Businesses expiring soon (within 7 days)
      const expiringSoon = enriched.filter(b => {
        const endDate = (b as any).subscription_ends_at || (b as any).trial_ends_at;
        if (!endDate) return false;
        const days = differenceInDays(new Date(endDate), now);
        return days >= 0 && days <= 7;
      });

      return {
        businesses: enriched,
        totalBusinesses: biz.length,
        totalUsers: allProfiles.length,
        totalProducts: allProducts.length,
        totalSales: completedSales.length,
        totalBranches: allBranches.length,
        totalRevenue,
        statusCounts,
        monthlyData,
        expiringSoon,
      };
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const { data, error } = await supabase
        .from('businesses')
        .insert({ name, subscription_status: 'pending' as SubscriptionStatus })
        .select()
        .single();
      if (error) throw error;
      const { error: branchError } = await supabase
        .from('branches')
        .insert({ business_id: data.id, name: 'Principal', is_main: true });
      if (branchError) throw branchError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-data'] });
      toast({ title: 'Negocio creado' });
      setCreateOpen(false);
      setNewBusiness({ name: '' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const manageMutation = useMutation({
    mutationFn: async (d: ManageData) => {
      const { error } = await supabase
        .from('businesses')
        .update({
          plan_type: d.plan_type,
          subscription_status: d.subscription_status,
          subscription_ends_at: d.subscription_ends_at || null,
          max_branches: d.max_branches,
        })
        .eq('id', d.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-data'] });
      toast({ title: 'Suscripción actualizada' });
      setManageOpen(false);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const openManage = (b: any) => {
    setManageData({
      id: b.id,
      name: b.name,
      plan_type: b.plan_type || 'trial',
      subscription_status: b.subscription_status,
      subscription_ends_at: b.subscription_ends_at ? format(new Date(b.subscription_ends_at), 'yyyy-MM-dd') : '',
      max_branches: b.max_branches || 1,
    });
    setManageOpen(true);
  };

  const filtered = data?.businesses?.filter((b) => {
    const matchSearch = b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.owner_name.toLowerCase().includes(search.toLowerCase()) ||
      b.owner_email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || b.subscription_status === filterStatus;
    return matchSearch && matchStatus;
  });

  const getStatusBadge = (status: SubscriptionStatus) => {
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPlanLabel = (plan: string | null) => {
    if (plan === 'mvp') return 'Profesional';
    if (plan === 'trial') return 'Prueba';
    return plan || 'Prueba';
  };

  const pieData = [
    { name: 'Activos', value: data?.statusCounts.active || 0 },
    { name: 'Pendientes', value: data?.statusCounts.pending || 0 },
    { name: 'Suspendidos', value: data?.statusCounts.suspended || 0 },
    { name: 'Cancelados', value: data?.statusCounts.cancelled || 0 },
  ].filter(d => d.value > 0);

  if (isLoading) {
    return (
      <AppLayout title="Panel de Administración">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Panel de Administración">
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <TrendingUp className="h-4 w-4" /> Resumen
          </TabsTrigger>
          <TabsTrigger value="businesses" className="gap-2">
            <Store className="h-4 w-4" /> Negocios
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart className="h-4 w-4" /> Estadísticas
          </TabsTrigger>
        </TabsList>

        {/* === OVERVIEW TAB === */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'Negocios', value: data?.totalBusinesses || 0, icon: Store, sub: `${data?.statusCounts.active || 0} activos` },
              { title: 'Usuarios', value: data?.totalUsers || 0, icon: Users, sub: 'registrados' },
              { title: 'Ventas', value: data?.totalSales || 0, icon: ShoppingCart, sub: 'completadas' },
              { title: 'Ingresos', value: `$${(data?.totalRevenue || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`, icon: DollarSign, sub: 'total facturado' },
            ].map((stat) => (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                  <div className="rounded-md p-2 bg-muted">
                    <stat.icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Revenue trend */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Tendencia de Ingresos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={data?.monthlyData || []}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => `$${v.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`} />
                    <Area type="monotone" dataKey="ingresos" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Expiring soon */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" /> Por Vencer
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data?.expiringSoon && data.expiringSoon.length > 0 ? (
                  <div className="space-y-3">
                    {data.expiringSoon.map((b: any) => {
                      const endDate = b.subscription_ends_at || b.trial_ends_at;
                      const days = endDate ? differenceInDays(new Date(endDate), new Date()) : 0;
                      return (
                        <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <p className="text-sm font-medium">{b.name}</p>
                            <p className="text-xs text-muted-foreground">{b.owner_email}</p>
                          </div>
                          <Badge variant={days <= 3 ? 'destructive' : 'secondary'}>
                            {days} día{days !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">No hay negocios por vencer</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent businesses quick view */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Últimos Registros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data?.businesses.slice(0, 5).map((b) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{b.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.owner_name} · {format(new Date(b.created_at), "d MMM yyyy", { locale: es })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{getPlanLabel((b as any).plan_type)}</Badge>
                      {getStatusBadge(b.subscription_status)}
                      <Button variant="ghost" size="sm" onClick={() => openManage(b)}>
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === BUSINESSES TAB === */}
        <TabsContent value="businesses" className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar negocio o dueño..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="suspended">Suspendidos</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Negocio
            </Button>
          </div>

          {/* Status summary pills */}
          <div className="flex flex-wrap gap-2">
            {Object.entries(data?.statusCounts || {}).map(([key, val]) => {
              const config = STATUS_CONFIG[key as SubscriptionStatus];
              return (
                <button
                  key={key}
                  onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filterStatus === key ? 'bg-primary text-primary-foreground' : 'bg-card text-card-foreground hover:bg-muted'}`}
                >
                  <config.icon className="h-3 w-3" />
                  {config.label}: {val}
                </button>
              );
            })}
          </div>

          <Card>
            <CardContent className="pt-6">
              {filtered && filtered.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Negocio</TableHead>
                        <TableHead>Dueño</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Vence</TableHead>
                        <TableHead className="text-center">Sucursales</TableHead>
                        <TableHead className="text-center">Productos</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((b) => {
                        const endDate = (b as any).subscription_ends_at || (b as any).trial_ends_at;
                        const daysLeft = endDate ? differenceInDays(new Date(endDate), new Date()) : null;
                        return (
                          <TableRow key={b.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <span className="font-medium">{b.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium">{b.owner_name}</p>
                                <p className="text-xs text-muted-foreground">{b.owner_email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1">
                                {(b as any).plan_type === 'mvp' && <Crown className="h-3 w-3" />}
                                {getPlanLabel((b as any).plan_type)}
                              </Badge>
                            </TableCell>
                            <TableCell>{getStatusBadge(b.subscription_status)}</TableCell>
                            <TableCell>
                              {endDate ? (
                                <div>
                                  <p className="text-sm">{format(new Date(endDate), "d MMM yyyy", { locale: es })}</p>
                                  <p className={`text-xs ${daysLeft !== null && daysLeft <= 3 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                    {daysLeft !== null && daysLeft >= 0 ? `${daysLeft} días` : daysLeft !== null ? 'Vencido' : ''}
                                  </p>
                                </div>
                              ) : '—'}
                            </TableCell>
                            <TableCell className="text-center">{b.branch_count}/{(b as any).max_branches || 1}</TableCell>
                            <TableCell className="text-center">{b.product_count}</TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" onClick={() => openManage(b)} className="gap-1">
                                <Settings className="h-4 w-4" /> Gestionar
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <Store className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No se encontraron negocios</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === STATS TAB === */}
        <TabsContent value="stats" className="space-y-6">
          {/* Stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: 'Total Negocios', value: data?.totalBusinesses || 0, icon: Store },
              { title: 'Usuarios', value: data?.totalUsers || 0, icon: Users },
              { title: 'Productos', value: data?.totalProducts || 0, icon: Package },
              { title: 'Ventas', value: data?.totalSales || 0, icon: ShoppingCart },
              { title: 'Sucursales', value: data?.totalBranches || 0, icon: Building2 },
              { title: 'Ingresos', value: `$${(data?.totalRevenue || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`, icon: DollarSign },
            ].map((stat) => (
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

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Monthly registrations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Registros Mensuales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data?.monthlyData || []}>
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="negocios" name="Negocios" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="ventas" name="Ventas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Status distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Store className="h-4 w-4" /> Distribución por Estado
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
        </TabsContent>
      </Tabs>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Negocio</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="business-name">Nombre del Negocio *</Label>
              <Input
                id="business-name"
                placeholder="Ej: Tienda La Esquina"
                value={newBusiness.name}
                onChange={(e) => setNewBusiness({ name: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => createMutation.mutate({ name: newBusiness.name })}
              disabled={!newBusiness.name.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creando...' : 'Crear Negocio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Dialog */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gestionar — {manageData?.name}</DialogTitle>
          </DialogHeader>
          {manageData && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={manageData.plan_type} onValueChange={(v) => setManageData(prev => prev ? { ...prev, plan_type: v } : null)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Prueba</SelectItem>
                    <SelectItem value="mvp">Profesional ($10/mes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={manageData.subscription_status} onValueChange={(v) => setManageData(prev => prev ? { ...prev, subscription_status: v as SubscriptionStatus } : null)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="suspended">Suspendido</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fecha de vencimiento</Label>
                <Input
                  type="date"
                  value={manageData.subscription_ends_at}
                  onChange={(e) => setManageData(prev => prev ? { ...prev, subscription_ends_at: e.target.value } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Máx. sucursales</Label>
                <Input
                  type="number"
                  min={1}
                  value={manageData.max_branches}
                  onChange={(e) => setManageData(prev => prev ? { ...prev, max_branches: parseInt(e.target.value) || 1 } : null)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setManageOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => manageData && manageMutation.mutate(manageData)}
              disabled={manageMutation.isPending}
            >
              {manageMutation.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default AdminDashboard;
