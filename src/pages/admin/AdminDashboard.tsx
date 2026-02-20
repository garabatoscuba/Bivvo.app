import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Store, Plus, CheckCircle, XCircle, Clock, Ban, Search, Loader2, Building2,
  Settings, Users, Package, ShoppingCart, TrendingUp, DollarSign, Crown,
  AlertTriangle, BarChart3, Activity, Trash2, FileText, Check, X,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { format, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area, CartesianGrid } from 'recharts';

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
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [newBusiness, setNewBusiness] = useState({
    name: '',
    plan_type: 'free' as string,
    subscription_status: 'pending' as SubscriptionStatus,
    max_branches: 1,
    subscription_ends_at: '',
  });

  // Unified query for all admin data
  const { data, isLoading } = useQuery({
    queryKey: ['admin-all-data'],
    queryFn: async () => {
      const [businesses, profiles, products, sales, branches, planRequests] = await Promise.all([
        supabase.from('businesses').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email, business_id'),
        supabase.from('products').select('id, business_id'),
        supabase.from('sales').select('id, total, created_at, status, branch_id'),
        supabase.from('branches').select('id, business_id'),
        supabase.from('plan_requests').select('*').order('created_at', { ascending: false }),
      ]);

      const biz = businesses.data || [];
      const allProfiles = profiles.data || [];
      const allProducts = products.data || [];
      const allSales = sales.data || [];
      const allBranches = branches.data || [];
      const allPlanRequests = planRequests.data || [];
      const completedSales = allSales.filter(s => s.status === 'completed');
      const totalRevenue = completedSales.reduce((sum, s) => sum + Number(s.total), 0);

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

      const statusCounts = {
        active: biz.filter(b => b.subscription_status === 'active').length,
        pending: biz.filter(b => b.subscription_status === 'pending').length,
        suspended: biz.filter(b => b.subscription_status === 'suspended').length,
        cancelled: biz.filter(b => b.subscription_status === 'cancelled').length,
      };

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

      const expiringSoon = enriched.filter(b => {
        const endDate = (b as any).subscription_ends_at || (b as any).trial_ends_at;
        if (!endDate) return false;
        const days = differenceInDays(new Date(endDate), now);
        return days >= 0 && days <= 7;
      });

      const profileByUserId = new Map(allProfiles.map(p => [p.id, p]));
      const enrichedRequests = allPlanRequests.map((r: any) => {
        const prof = allProfiles.find(p => (p as any).user_id === r.user_id);
        return { ...r, user_name: prof?.full_name || 'Desconocido', user_email: prof?.email || '' };
      });

      const pendingRequests = enrichedRequests.filter((r: any) => r.status === 'pending');

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
        planRequests: enrichedRequests,
        pendingRequests,
      };
    },
  });

  const defaultNewBusiness = {
    name: '',
    plan_type: 'free' as string,
    subscription_status: 'pending' as SubscriptionStatus,
    max_branches: 1,
    subscription_ends_at: '',
  };

  const createMutation = useMutation({
    mutationFn: async (biz: typeof defaultNewBusiness) => {
      const { data, error } = await supabase
        .from('businesses')
        .insert({
          name: biz.name,
          plan_type: biz.plan_type,
          subscription_status: biz.subscription_status,
          max_branches: biz.max_branches,
          subscription_ends_at: biz.subscription_ends_at || null,
        })
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
      setNewBusiness({ ...defaultNewBusiness });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('businesses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-data'] });
      toast({ title: 'Negocio eliminado', description: 'El negocio y todos sus datos han sido eliminados.' });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: 'Error al eliminar', description: err.message, variant: 'destructive' });
      setDeleteTarget(null);
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

  const approveMutation = useMutation({
    mutationFn: async ({ requestId, action, customEndDate }: { requestId: string; action: 'approved' | 'rejected'; customEndDate?: string }) => {
      const request = data?.planRequests?.find((r: any) => r.id === requestId);
      if (!request) throw new Error('Solicitud no encontrada');

      const updates: any = { status: action, approved_at: new Date().toISOString() };
      if (customEndDate) updates.custom_end_date = customEndDate;

      const { error: reqError } = await supabase
        .from('plan_requests')
        .update(updates)
        .eq('id', requestId);
      if (reqError) throw reqError;

      if (action === 'approved') {
        const endDate = customEndDate
          ? new Date(customEndDate)
          : new Date(Date.now() + (request as any).months * 30 * 24 * 60 * 60 * 1000);

        const { error: profError } = await supabase
          .from('profiles')
          .update({
            plan_type: (request as any).plan_type,
            subscription_status: 'active',
            subscription_ends_at: endDate.toISOString(),
            trial_ends_at: null,
          })
          .eq('user_id', (request as any).user_id);
        if (profError) throw profError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-data'] });
      toast({ title: 'Solicitud procesada' });
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
      <Badge variant={config.variant} className="gap-1 text-[11px]">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getPlanLabel = (plan: string | null) => {
    if (plan === 'mvp') return 'Profesional';
    if (plan === 'professional') return 'Profesional';
    if (plan === 'basic') return 'Básico';
    if (plan === 'free') return 'Gratuito';
    if (plan === 'trial') return 'Prueba';
    return plan || 'Gratuito';
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
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const kpiItems = [
    { title: 'Negocios', value: data?.totalBusinesses || 0, icon: Store, sub: `${data?.statusCounts.active || 0} activos` },
    { title: 'Usuarios', value: data?.totalUsers || 0, icon: Users, sub: 'registrados' },
    { title: 'Ventas', value: data?.totalSales || 0, icon: ShoppingCart, sub: 'completadas' },
    { title: 'Ingresos', value: `$${(data?.totalRevenue || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`, icon: DollarSign, sub: 'total facturado' },
  ];

  return (
    <AppLayout title="Panel de Administración">
      <div className="space-y-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList className="bg-muted/60">
              <TabsTrigger value="overview" className="gap-1.5 text-xs">
                <Activity className="h-3.5 w-3.5" /> Resumen
              </TabsTrigger>
              <TabsTrigger value="businesses" className="gap-1.5 text-xs">
                <Store className="h-3.5 w-3.5" /> Negocios
              </TabsTrigger>
              <TabsTrigger value="stats" className="gap-1.5 text-xs">
                <BarChart3 className="h-3.5 w-3.5" /> Estadísticas
              </TabsTrigger>
              <TabsTrigger value="requests" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" /> Solicitudes
                {(data?.pendingRequests?.length || 0) > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]">{data?.pendingRequests?.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* === OVERVIEW === */}
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

            <div className="grid gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-3 border-border/60">
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
                      <Tooltip
                        formatter={(v: number) => `$${v.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`}
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                      />
                      <Area type="monotone" dataKey="ingresos" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.08)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2 border-border/60">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <CardTitle className="text-sm font-medium">Por Vencer</CardTitle>
                  </div>
                  <CardDescription className="text-xs">Próximos 7 días</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {data?.expiringSoon && data.expiringSoon.length > 0 ? (
                    <div className="space-y-2">
                      {data.expiringSoon.map((b: any) => {
                        const endDate = b.subscription_ends_at || b.trial_ends_at;
                        const days = endDate ? differenceInDays(new Date(endDate), new Date()) : 0;
                        return (
                          <div key={b.id} className="flex items-center justify-between border border-border/60 p-2.5 rounded-md">
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{b.name}</p>
                              <p className="text-[11px] text-muted-foreground truncate">{b.owner_email}</p>
                            </div>
                            <Badge variant={days <= 3 ? 'destructive' : 'secondary'} className="text-[11px] ml-2 shrink-0">
                              {days}d
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mb-2 opacity-30" />
                      <p className="text-xs">Sin vencimientos próximos</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Últimos Registros</CardTitle>
                <CardDescription className="text-xs">Negocios recién creados</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="divide-y divide-border/60">
                  {data?.businesses.slice(0, 5).map((b) => (
                    <div key={b.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/60">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{b.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {b.owner_name} · {format(new Date(b.created_at), "d MMM yyyy", { locale: es })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-2 shrink-0">
                        <Badge variant="outline" className="text-[11px] hidden sm:inline-flex">{getPlanLabel((b as any).plan_type)}</Badge>
                        {getStatusBadge(b.subscription_status)}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openManage(b)}>
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === BUSINESSES === */}
          <TabsContent value="businesses" className="space-y-4 mt-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar negocio..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-9 text-sm"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[140px] h-9 text-sm">
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
              <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Nuevo Negocio
              </Button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {Object.entries(data?.statusCounts || {}).map(([key, val]) => {
                const config = STATUS_CONFIG[key as SubscriptionStatus];
                const isActive = filterStatus === key;
                return (
                  <button
                    key={key}
                    onClick={() => setFilterStatus(filterStatus === key ? 'all' : key)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${isActive ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border/60 hover:bg-muted/60'}`}
                  >
                    <config.icon className="h-3 w-3" />
                    {config.label}: {val}
                  </button>
                );
              })}
            </div>

            <Card className="border-border/60">
              <CardContent className="p-0">
                {filtered && filtered.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[11px] uppercase tracking-wide">Negocio</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide">Dueño</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide">Plan</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide">Estado</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide">Vence</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide text-center">Suc.</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide text-center">Prod.</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide text-right">Acción</TableHead>
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
                                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/60">
                                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                  </div>
                                  <span className="text-sm font-medium">{b.name}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm">{b.owner_name}</p>
                                <p className="text-[11px] text-muted-foreground">{b.owner_email}</p>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="gap-1 text-[11px]">
                                  {(b as any).plan_type === 'mvp' && <Crown className="h-3 w-3" />}
                                  {getPlanLabel((b as any).plan_type)}
                                </Badge>
                              </TableCell>
                              <TableCell>{getStatusBadge(b.subscription_status)}</TableCell>
                              <TableCell>
                                {endDate ? (
                                  <div>
                                    <p className="text-sm">{format(new Date(endDate), "d MMM yy", { locale: es })}</p>
                                    <p className={`text-[11px] ${daysLeft !== null && daysLeft <= 3 ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                      {daysLeft !== null && daysLeft >= 0 ? `${daysLeft}d restantes` : daysLeft !== null ? 'Vencido' : ''}
                                    </p>
                                  </div>
                                ) : <span className="text-muted-foreground">—</span>}
                              </TableCell>
                              <TableCell className="text-center text-sm">{b.branch_count}/{(b as any).max_branches || 1}</TableCell>
                              <TableCell className="text-center text-sm">{b.product_count}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => openManage(b)} className="gap-1 h-7 text-xs">
                                    <Settings className="h-3.5 w-3.5" /> Gestionar
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => setDeleteTarget({ id: b.id, name: b.name })}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Store className="mx-auto h-10 w-10 text-muted-foreground/30" />
                    <p className="mt-3 text-sm text-muted-foreground">No se encontraron negocios</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* === STATS === */}
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

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Registros Mensuales</CardTitle>
                  <CardDescription className="text-xs">Negocios y ventas por mes</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data?.monthlyData || []} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="negocios" name="Negocios" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="ventas" name="Ventas" fill="hsl(var(--success))" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Distribución por Estado</CardTitle>
                  <CardDescription className="text-xs">Estado de suscripción de negocios</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          dataKey="value"
                          strokeWidth={2}
                          stroke="hsl(var(--card))"
                          label={({ name, value }) => `${name}: ${value}`}
                        >
                          {pieData.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Tooltip
                          contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '6px',
                            fontSize: '12px',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
                      No hay datos suficientes
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* === PLAN REQUESTS === */}
          <TabsContent value="requests" className="space-y-4 mt-0">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Solicitudes de Plan</CardTitle>
                <CardDescription className="text-xs">Solicitudes enviadas por usuarios</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {data?.planRequests && data.planRequests.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[11px] uppercase tracking-wide">Usuario</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide">Plan</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide">Meses</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide">Sucursales</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide">Total</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide">Estado</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide">Fecha</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.planRequests.map((r: any) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <p className="text-sm font-medium">{r.user_name}</p>
                              <p className="text-[11px] text-muted-foreground">{r.user_email}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[11px]">
                                {r.plan_type === 'professional' ? 'Profesional' : 'Básico'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{r.months}</TableCell>
                            <TableCell className="text-sm">{r.total_branches}</TableCell>
                            <TableCell className="text-sm font-medium">${Number(r.total_amount).toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'}
                                className="text-[11px]"
                              >
                                {r.status === 'approved' ? 'Aprobada' : r.status === 'rejected' ? 'Rechazada' : 'Pendiente'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(r.created_at), "d MMM yy", { locale: es })}
                            </TableCell>
                            <TableCell className="text-right">
                              {r.status === 'pending' && (
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                    onClick={() => approveMutation.mutate({ requestId: r.id, action: 'approved' })}
                                    disabled={approveMutation.isPending}
                                    title="Aprobar"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => approveMutation.mutate({ requestId: r.id, action: 'rejected' })}
                                    disabled={approveMutation.isPending}
                                    title="Rechazar"
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <FileText className="mx-auto h-10 w-10 text-muted-foreground/30" />
                    <p className="mt-3 text-sm text-muted-foreground">No hay solicitudes</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Registrar Nuevo Negocio</DialogTitle>
            <DialogDescription className="text-sm">Crea un negocio con su sucursal principal.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre del Negocio *</Label>
              <Input
                placeholder="Ej: Tienda La Esquina"
                value={newBusiness.name}
                onChange={(e) => setNewBusiness(prev => ({ ...prev, name: e.target.value }))}
                className="h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Plan</Label>
                <Select value={newBusiness.plan_type} onValueChange={(v) => setNewBusiness(prev => ({ ...prev, plan_type: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Gratuito</SelectItem>
                    <SelectItem value="basic">Básico</SelectItem>
                    <SelectItem value="professional">Profesional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
                <Select value={newBusiness.subscription_status} onValueChange={(v) => setNewBusiness(prev => ({ ...prev, subscription_status: v as SubscriptionStatus }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="suspended">Suspendido</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Vencimiento suscripción</Label>
                <Input
                  type="date"
                  className="h-9 text-sm"
                  value={newBusiness.subscription_ends_at}
                  onChange={(e) => setNewBusiness(prev => ({ ...prev, subscription_ends_at: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Máx. sucursales</Label>
                <Input
                  type="number"
                  min={1}
                  className="h-9 text-sm"
                  value={newBusiness.max_branches}
                  onChange={(e) => setNewBusiness(prev => ({ ...prev, max_branches: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button
              size="sm"
              onClick={() => createMutation.mutate(newBusiness)}
              disabled={!newBusiness.name.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creando...' : 'Crear Negocio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Dialog */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{manageData?.name}</DialogTitle>
            <DialogDescription className="text-sm">Configura plan, estado y límites.</DialogDescription>
          </DialogHeader>
          {manageData && (
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Plan</Label>
                  <Select value={manageData.plan_type} onValueChange={(v) => setManageData(prev => prev ? { ...prev, plan_type: v } : null)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Gratuito</SelectItem>
                      <SelectItem value="basic">Básico</SelectItem>
                      <SelectItem value="professional">Profesional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Estado</Label>
                  <Select value={manageData.subscription_status} onValueChange={(v) => setManageData(prev => prev ? { ...prev, subscription_status: v as SubscriptionStatus } : null)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="active">Activo</SelectItem>
                      <SelectItem value="suspended">Suspendido</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Vencimiento</Label>
                  <Input
                    type="date"
                    className="h-9 text-sm"
                    value={manageData.subscription_ends_at}
                    onChange={(e) => setManageData(prev => prev ? { ...prev, subscription_ends_at: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Máx. sucursales</Label>
                  <Input
                    type="number"
                    min={1}
                    className="h-9 text-sm"
                    value={manageData.max_branches}
                    onChange={(e) => setManageData(prev => prev ? { ...prev, max_branches: parseInt(e.target.value) || 1 } : null)}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <div className="flex w-full items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                onClick={() => {
                  setManageOpen(false);
                  if (manageData) setDeleteTarget({ id: manageData.id, name: manageData.name });
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setManageOpen(false)}>Cancelar</Button>
                <Button
                  size="sm"
                  onClick={() => manageData && manageMutation.mutate(manageData)}
                  disabled={manageMutation.isPending}
                >
                  {manageMutation.isPending ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar negocio?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará <strong>{deleteTarget?.name}</strong> junto con todas sus sucursales, productos, ventas, empleados y datos asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Sí, eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default AdminDashboard;
