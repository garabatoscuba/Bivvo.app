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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Store, Plus, Search, Loader2, Building2,
  Settings, Users, Package, ShoppingCart, DollarSign,
  BarChart3, Activity, Trash2, FileText, Check, X,
  Pencil, Power, MapPin, Phone,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';

const AdminDashboard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [newBizName, setNewBizName] = useState('');
  const [editBiz, setEditBiz] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editBranches, setEditBranches] = useState<any[]>([]);
  const [deleteBranchTarget, setDeleteBranchTarget] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-all-data'],
    queryFn: async () => {
      const [businesses, profiles, products, sales, branches, planRequests, businessRequests] = await Promise.all([
        supabase.from('businesses').select('*, is_active').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, full_name, email, business_id, user_id, plan_type, subscription_status'),
        supabase.from('products').select('id, business_id'),
        supabase.from('sales').select('id, total, created_at, status, branch_id'),
        supabase.from('branches').select('id, business_id, name, is_main, address, phone'),
        supabase.from('plan_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('business_requests').select('*').order('created_at', { ascending: false }),
      ]);

      const biz = businesses.data || [];
      const allProfiles = profiles.data || [];
      const allProducts = products.data || [];
      const allSales = sales.data || [];
      const allBranches = branches.data || [];
      const allPlanRequests = planRequests.data || [];
      const allBusinessRequests = businessRequests.data || [];
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
          owner_plan: owner?.plan_type || 'free',
          branch_count: branchCount,
          product_count: productCount,
        };
      });

      const now = new Date();
      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const label = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
        const bizCount = biz.filter(b => new Date(b.created_at) >= d && new Date(b.created_at) <= monthEnd).length;
        const salesCount = completedSales.filter(s => new Date(s.created_at) >= d && new Date(s.created_at) <= monthEnd).length;
        const revenue = completedSales
          .filter(s => new Date(s.created_at) >= d && new Date(s.created_at) <= monthEnd)
          .reduce((sum, s) => sum + Number(s.total), 0);
        monthlyData.push({ name: label, negocios: bizCount, ventas: salesCount, ingresos: revenue });
      }

      const enrichedRequests = allPlanRequests.map((r: any) => {
        const prof = allProfiles.find(p => (p as any).user_id === r.user_id);
        return { ...r, user_name: prof?.full_name || 'Desconocido', user_email: prof?.email || '' };
      });

      const enrichedBizRequests = allBusinessRequests.map((r: any) => {
        const prof = allProfiles.find(p => (p as any).user_id === r.user_id);
        return { ...r, user_name: prof?.full_name || 'Desconocido', user_email: prof?.email || '' };
      });

      const pendingRequests = enrichedRequests.filter((r: any) => r.status === 'pending');
      const pendingBizRequests = enrichedBizRequests.filter((r: any) => r.status === 'pending');

      return {
        businesses: enriched,
        totalBusinesses: biz.length,
        totalUsers: allProfiles.length,
        totalProducts: allProducts.length,
        totalSales: completedSales.length,
        totalBranches: allBranches.length,
        totalRevenue,
        monthlyData,
        planRequests: enrichedRequests,
        pendingRequests,
        businessRequests: enrichedBizRequests,
        pendingBizRequests,
      };
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.functions.invoke('create-business', {
        body: { name },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data.business;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-data'] });
      toast({ title: 'Negocio creado' });
      setCreateOpen(false);
      setNewBizName('');
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
      toast({ title: 'Negocio eliminado' });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setDeleteTarget(null);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ requestId, action, customEndDate }: { requestId: string; action: 'approved' | 'rejected'; customEndDate?: string }) => {
      const request = data?.planRequests?.find((r: any) => r.id === requestId);
      if (!request) throw new Error('Solicitud no encontrada');

      const updates: any = { status: action, approved_at: new Date().toISOString() };
      if (customEndDate) updates.custom_end_date = customEndDate;

      const { error: reqError } = await supabase.from('plan_requests').update(updates).eq('id', requestId);
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

  const approveBizRequestMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: 'approved' | 'rejected' }) => {
      const { data, error } = await supabase.functions.invoke('approve-business-request', {
        body: { request_id: requestId, action },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-data'] });
      toast({ title: 'Solicitud procesada' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const openEditBiz = async (biz: any) => {
    setEditBiz(biz);
    setEditName(biz.name);
    setEditType(biz.business_type || 'store');
    const { data: branchData } = await supabase
      .from('branches')
      .select('*')
      .eq('business_id', biz.id)
      .order('is_main', { ascending: false })
      .order('name');
    setEditBranches(branchData || []);
  };

  const updateBizMutation = useMutation({
    mutationFn: async ({ id, name, business_type, is_active }: { id: string; name: string; business_type: string; is_active: boolean }) => {
      const { error } = await supabase.from('businesses').update({ name, business_type, is_active } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-data'] });
      toast({ title: 'Negocio actualizado' });
      setEditBiz(null);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteBranchMutation = useMutation({
    mutationFn: async (branchId: string) => {
      const { error } = await supabase.from('branches').delete().eq('id', branchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-data'] });
      setEditBranches(prev => prev.filter(b => b.id !== deleteBranchTarget?.id));
      toast({ title: 'Sucursal eliminada' });
      setDeleteBranchTarget(null);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setDeleteBranchTarget(null);
    },
  });

  const getPlanLabel = (plan: string | null) => {
    if (plan === 'professional') return 'Profesional';
    if (plan === 'basic') return 'Básico';
    return 'Gratuito';
  };

  const filtered = data?.businesses?.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.owner_name.toLowerCase().includes(search.toLowerCase()) ||
    b.owner_email.toLowerCase().includes(search.toLowerCase())
  );

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
    { title: 'Negocios', value: data?.totalBusinesses || 0, icon: Store, sub: 'registrados' },
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
                <FileText className="h-3.5 w-3.5" /> Solicitudes Planes
                {(data?.pendingRequests?.length || 0) > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]">{data?.pendingRequests?.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="biz-requests" className="gap-1.5 text-xs">
                <Building2 className="h-3.5 w-3.5" /> Solicitudes Negocios
                {(data?.pendingBizRequests?.length || 0) > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]">{data?.pendingBizRequests?.length}</Badge>
                )}
              </TabsTrigger>
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

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Últimos Registros</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="divide-y divide-border/60">
                  {data?.businesses.slice(0, 5).map((b) => (
                    <div key={b.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{b.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {b.owner_name} · {format(new Date(b.created_at), "d MMM yyyy", { locale: es })}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[11px] ml-2 shrink-0">{getPlanLabel(b.owner_plan)}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BUSINESSES */}
          <TabsContent value="businesses" className="space-y-4 mt-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Buscar negocio..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
              </div>
              <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Nuevo Negocio
              </Button>
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
                          <TableHead className="text-[11px] uppercase tracking-wide">Plan (usuario)</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide text-center">Estado</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide text-center">Suc.</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide text-center">Prod.</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filtered.map((b) => (
                          <TableRow key={b.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <span className="text-sm font-medium">{b.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{b.owner_name}</p>
                              <p className="text-[11px] text-muted-foreground">{b.owner_email}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[11px]">{getPlanLabel(b.owner_plan)}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant={b.is_active !== false ? 'default' : 'secondary'} className="text-[11px]">
                                {b.is_active !== false ? 'Activo' : 'Inactivo'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-sm">{b.branch_count}</TableCell>
                            <TableCell className="text-center text-sm">{b.product_count}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7"
                                  onClick={() => openEditBiz(b)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="ghost" size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setDeleteTarget({ id: b.id, name: b.name })}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-sm text-muted-foreground">No se encontraron negocios</div>
                )}
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
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Registros y Ventas Mensuales</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data?.monthlyData || []} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' }} />
                    <Bar dataKey="negocios" name="Negocios" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="ventas" name="Ventas" fill="hsl(142, 71%, 45%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PLAN REQUESTS */}
          <TabsContent value="requests" className="space-y-4 mt-0">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Solicitudes de Plan</CardTitle>
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
                          <TableHead className="text-[11px] uppercase tracking-wide">Total</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide">Estado</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide">Fecha</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide text-right">Acción</TableHead>
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
                              <Badge variant="outline" className="text-[11px]">{getPlanLabel(r.plan_type)}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{r.months}m</TableCell>
                            <TableCell className="text-sm font-medium">${Number(r.total_amount).toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge
                                variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'}
                                className="text-[11px]"
                              >
                                {r.status === 'approved' ? 'Aprobado' : r.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[11px] text-muted-foreground">
                              {format(new Date(r.created_at), "d MMM yy", { locale: es })}
                            </TableCell>
                            <TableCell className="text-right">
                              {r.status === 'pending' && (
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-7 w-7 text-green-600 hover:bg-green-50"
                                    onClick={() => approveMutation.mutate({ requestId: r.id, action: 'approved' })}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                    onClick={() => approveMutation.mutate({ requestId: r.id, action: 'rejected' })}
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
                  <div className="py-12 text-center text-sm text-muted-foreground">No hay solicitudes</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BUSINESS REQUESTS */}
          <TabsContent value="biz-requests" className="space-y-4 mt-0">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Solicitudes de Negocios y Sucursales</CardTitle>
                <CardDescription className="text-xs">Aprueba o rechaza las solicitudes de creación</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {data?.businessRequests && data.businessRequests.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[11px] uppercase tracking-wide">Solicitante</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide">Tipo</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide">Nombre</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide">Estado</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide">Fecha</TableHead>
                          <TableHead className="text-[11px] uppercase tracking-wide text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.businessRequests.map((r: any) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <p className="text-sm font-medium">{r.user_name}</p>
                              <p className="text-[11px] text-muted-foreground">{r.user_email}</p>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[11px]">
                                {r.request_type === 'business' ? '🏪 Negocio' : '📍 Sucursal'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{r.business_name || r.branch_name}</TableCell>
                            <TableCell>
                              <Badge
                                variant={r.status === 'approved' ? 'default' : r.status === 'rejected' ? 'destructive' : 'secondary'}
                                className="text-[11px]"
                              >
                                {r.status === 'approved' ? 'Aprobado' : r.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-[11px] text-muted-foreground">
                              {format(new Date(r.created_at), "d MMM yy", { locale: es })}
                            </TableCell>
                            <TableCell className="text-right">
                              {r.status === 'pending' && (
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-7 w-7 text-primary hover:bg-primary/10"
                                    onClick={() => approveBizRequestMutation.mutate({ requestId: r.id, action: 'approved' })}
                                    disabled={approveBizRequestMutation.isPending}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                    onClick={() => approveBizRequestMutation.mutate({ requestId: r.id, action: 'rejected' })}
                                    disabled={approveBizRequestMutation.isPending}
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
                  <div className="py-12 text-center text-sm text-muted-foreground">No hay solicitudes de negocios</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nuevo Negocio</DialogTitle></DialogHeader>
            <div className="space-y-2 py-4">
              <Label>Nombre</Label>
              <Input placeholder="Ej: Mi Tienda" value={newBizName} onChange={(e) => setNewBizName(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button onClick={() => createMutation.mutate(newBizName)} disabled={!newBizName.trim() || createMutation.isPending}>
                {createMutation.isPending ? 'Creando...' : 'Crear'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar {deleteTarget?.name}?</AlertDialogTitle>
              <AlertDialogDescription>Se eliminarán todos los datos del negocio. Los perfiles asociados quedarán sin negocio.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Business Dialog */}
        <Dialog open={!!editBiz} onOpenChange={(open) => !open && setEditBiz(null)}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" /> Editar Negocio
              </DialogTitle>
              <DialogDescription>Modifica los datos, estado y sucursales del negocio.</DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Tipo de negocio</Label>
                <Input value={editType} onChange={(e) => setEditType(e.target.value)} placeholder="store, restaurant, etc." />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Estado del negocio</p>
                  <p className="text-[11px] text-muted-foreground">
                    {editBiz?.is_active !== false ? 'El negocio está activo' : 'El negocio está desactivado'}
                  </p>
                </div>
                <Switch
                  checked={editBiz?.is_active !== false}
                  onCheckedChange={(checked) => setEditBiz((prev: any) => prev ? { ...prev, is_active: checked } : null)}
                />
              </div>

              {/* Branches */}
              <div className="space-y-2">
                <Label>Sucursales ({editBranches.length})</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {editBranches.map((br) => (
                    <div key={br.id} className="flex items-center justify-between rounded-md border border-border p-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium truncate">{br.name}</span>
                          {br.is_main && <Badge variant="secondary" className="text-[10px] ml-1">Principal</Badge>}
                        </div>
                        {br.address && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {br.address}
                          </p>
                        )}
                      </div>
                      {!br.is_main && (
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                          onClick={() => setDeleteBranchTarget({ id: br.id, name: br.name })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {editBranches.length === 0 && (
                    <p className="text-sm text-muted-foreground py-2 text-center">Sin sucursales</p>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditBiz(null)}>Cancelar</Button>
              <Button
                onClick={() => editBiz && updateBizMutation.mutate({
                  id: editBiz.id,
                  name: editName.trim(),
                  business_type: editType.trim(),
                  is_active: editBiz.is_active !== false,
                })}
                disabled={!editName.trim() || updateBizMutation.isPending}
              >
                {updateBizMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Branch Confirmation */}
        <AlertDialog open={!!deleteBranchTarget} onOpenChange={() => setDeleteBranchTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar sucursal "{deleteBranchTarget?.name}"?</AlertDialogTitle>
              <AlertDialogDescription>Se eliminarán todos los datos asociados a esta sucursal (stock, ventas, movimientos).</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteBranchTarget && deleteBranchMutation.mutate(deleteBranchTarget.id)}>
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
