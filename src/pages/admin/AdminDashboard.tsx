import { useState, useMemo, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import AdminOffersTab from '@/components/admin/AdminOffersTab';
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Store, Search, Loader2, Building2,
  Settings, Users, Package, ShoppingCart, DollarSign,
  BarChart3, Activity, Trash2, FileText, Check, X,
  Pencil, MapPin, Tag,
  ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, CartesianGrid } from 'recharts';

type SortDir = 'asc' | 'desc';

// Generic sortable header
const SortHead = ({ label, sortKey: sk, currentKey, currentDir, onToggle, className }: {
  label: string; sortKey: string; currentKey: string; currentDir: SortDir;
  onToggle: (k: any) => void; className?: string;
}) => (
  <TableHead
    className={`cursor-pointer select-none hover:text-foreground text-[11px] uppercase tracking-wide ${className || ''}`}
    onClick={() => onToggle(sk)}
  >
    <span className="inline-flex items-center gap-1">
      {label}
      {currentKey === sk
        ? (currentDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
        : <ArrowUpDown className="h-3 w-3 opacity-30" />
      }
    </span>
  </TableHead>
);

// Generic sort toggle hook
function useSortToggle<K extends string>(defaultKey: K) {
  const [key, setKey] = useState<K>(defaultKey);
  const [dir, setDir] = useState<SortDir>('desc');
  const toggle = useCallback((k: K) => {
    setKey(prev => {
      if (prev === k) { setDir(d => d === 'asc' ? 'desc' : 'asc'); return k; }
      setDir('desc'); return k;
    });
  }, []);
  return { key, dir, toggle } as const;
}

// Generic sort function
function sortData<T>(arr: T[], key: string, dir: SortDir, numericKeys: string[] = [], dateKeys: string[] = []): T[] {
  return [...arr].sort((a: any, b: any) => {
    let va: any, vb: any;
    if (dateKeys.includes(key)) { va = new Date(a[key]).getTime(); vb = new Date(b[key]).getTime(); }
    else if (numericKeys.includes(key)) { va = Number(a[key] || 0); vb = Number(b[key] || 0); }
    else { va = (a[key] || '').toString().toLowerCase(); vb = (b[key] || '').toString().toLowerCase(); }
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

const AdminDashboard = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [editBiz, setEditBiz] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editBranches, setEditBranches] = useState<any[]>([]);
  const [deleteBranchTarget, setDeleteBranchTarget] = useState<{ id: string; name: string } | null>(null);

  // Business filters
  const [bizSearch, setBizSearch] = useState('');
  const [bizFilterStatus, setBizFilterStatus] = useState('all');
  const [bizFilterPlan, setBizFilterPlan] = useState('all');
  const bizSort = useSortToggle<string>('created_at');

  // Plan request filters
  const [reqSearch, setReqSearch] = useState('');
  const [reqFilterStatus, setReqFilterStatus] = useState('all');
  const reqSort = useSortToggle<string>('created_at');

  // Business request filters
  const [bizReqSearch, setBizReqSearch] = useState('');
  const [bizReqFilterStatus, setBizReqFilterStatus] = useState('all');
  const [bizReqFilterType, setBizReqFilterType] = useState('all');
  const bizReqSort = useSortToggle<string>('created_at');

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
        return {
          ...b,
          owner_name: owner?.full_name || 'Sin dueño',
          owner_email: owner?.email || '',
          owner_plan: owner?.plan_type || 'free',
          branch_count: allBranches.filter(br => br.business_id === b.id).length,
          product_count: allProducts.filter(p => p.business_id === b.id).length,
        };
      });

      const now = new Date();
      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const label = d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
        monthlyData.push({
          name: label,
          negocios: biz.filter(b => new Date(b.created_at) >= d && new Date(b.created_at) <= monthEnd).length,
          ventas: completedSales.filter(s => new Date(s.created_at) >= d && new Date(s.created_at) <= monthEnd).length,
          ingresos: completedSales.filter(s => new Date(s.created_at) >= d && new Date(s.created_at) <= monthEnd).reduce((sum, s) => sum + Number(s.total), 0),
        });
      }

      const enrichReqs = (reqs: any[]) => reqs.map((r: any) => {
        const prof = allProfiles.find(p => (p as any).user_id === r.user_id);
        return { ...r, user_name: prof?.full_name || 'Desconocido', user_email: prof?.email || '' };
      });

      const enrichedRequests = enrichReqs(allPlanRequests);
      const enrichedBizRequests = enrichReqs(allBusinessRequests);

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
        pendingRequests: enrichedRequests.filter((r: any) => r.status === 'pending'),
        businessRequests: enrichedBizRequests,
        pendingBizRequests: enrichedBizRequests.filter((r: any) => r.status === 'pending'),
      };
    },
  });

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('businesses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-all-data'] }); toast({ title: 'Negocio eliminado' }); setDeleteTarget(null); },
    onError: (err: any) => { toast({ title: 'Error', description: err.message, variant: 'destructive' }); setDeleteTarget(null); },
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
        const endDate = customEndDate ? new Date(customEndDate) : new Date(Date.now() + (request as any).months * 30 * 24 * 60 * 60 * 1000);
        const { error: profError } = await supabase.from('profiles').update({
          plan_type: (request as any).plan_type, subscription_status: 'active',
          subscription_ends_at: endDate.toISOString(), trial_ends_at: null,
        }).eq('user_id', (request as any).user_id);
        if (profError) throw profError;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-all-data'] }); toast({ title: 'Solicitud procesada' }); },
    onError: (err: any) => { toast({ title: 'Error', description: err.message, variant: 'destructive' }); },
  });

  const approveBizRequestMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: 'approved' | 'rejected' }) => {
      const { data, error } = await supabase.functions.invoke('approve-business-request', { body: { request_id: requestId, action } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-all-data'] }); toast({ title: 'Solicitud procesada' }); },
    onError: (err: any) => { toast({ title: 'Error', description: err.message, variant: 'destructive' }); },
  });

  const openEditBiz = async (biz: any) => {
    setEditBiz(biz);
    setEditName(biz.name);
    setEditType(biz.business_type || 'store');
    const { data: branchData } = await supabase.from('branches').select('*').eq('business_id', biz.id).order('is_main', { ascending: false }).order('name');
    setEditBranches(branchData || []);
  };

  const updateBizMutation = useMutation({
    mutationFn: async ({ id, name, business_type, is_active }: { id: string; name: string; business_type: string; is_active: boolean }) => {
      const { error } = await supabase.from('businesses').update({ name, business_type, is_active } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-all-data'] }); toast({ title: 'Negocio actualizado' }); setEditBiz(null); },
    onError: (err: any) => { toast({ title: 'Error', description: err.message, variant: 'destructive' }); },
  });

  const deleteBranchMutation = useMutation({
    mutationFn: async (branchId: string) => {
      const { error } = await supabase.from('branches').delete().eq('id', branchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-all-data'] });
      setEditBranches(prev => prev.filter(b => b.id !== deleteBranchTarget?.id));
      toast({ title: 'Sucursal eliminada' }); setDeleteBranchTarget(null);
    },
    onError: (err: any) => { toast({ title: 'Error', description: err.message, variant: 'destructive' }); setDeleteBranchTarget(null); },
  });

  const getPlanLabel = (plan: string | null) => {
    if (plan === 'professional') return 'Profesional';
    if (plan === 'basic') return 'Básico';
    return 'Gratuito';
  };

  // Filtered + sorted data
  const filteredBiz = useMemo(() => {
    let list = data?.businesses || [];
    const q = bizSearch.toLowerCase().trim();
    if (q) list = list.filter(b => b.name.toLowerCase().includes(q) || b.owner_name.toLowerCase().includes(q) || b.owner_email.toLowerCase().includes(q));
    if (bizFilterStatus !== 'all') list = list.filter(b => bizFilterStatus === 'active' ? b.is_active !== false : b.is_active === false);
    if (bizFilterPlan !== 'all') list = list.filter(b => b.owner_plan === bizFilterPlan);
    return sortData(list, bizSort.key, bizSort.dir, ['branch_count', 'product_count'], ['created_at']);
  }, [data?.businesses, bizSearch, bizFilterStatus, bizFilterPlan, bizSort.key, bizSort.dir]);

  const filteredPlanReqs = useMemo(() => {
    let list = data?.planRequests || [];
    const q = reqSearch.toLowerCase().trim();
    if (q) list = list.filter((r: any) => r.user_name.toLowerCase().includes(q) || r.user_email.toLowerCase().includes(q));
    if (reqFilterStatus !== 'all') list = list.filter((r: any) => r.status === reqFilterStatus);
    return sortData(list, reqSort.key, reqSort.dir, ['months', 'total_amount'], ['created_at']);
  }, [data?.planRequests, reqSearch, reqFilterStatus, reqSort.key, reqSort.dir]);

  const filteredBizReqs = useMemo(() => {
    let list = data?.businessRequests || [];
    const q = bizReqSearch.toLowerCase().trim();
    if (q) list = list.filter((r: any) => r.user_name.toLowerCase().includes(q) || r.user_email.toLowerCase().includes(q) || (r.business_name || r.branch_name || '').toLowerCase().includes(q));
    if (bizReqFilterStatus !== 'all') list = list.filter((r: any) => r.status === bizReqFilterStatus);
    if (bizReqFilterType !== 'all') list = list.filter((r: any) => r.request_type === bizReqFilterType);
    return sortData(list, bizReqSort.key, bizReqSort.dir, [], ['created_at']);
  }, [data?.businessRequests, bizReqSearch, bizReqFilterStatus, bizReqFilterType, bizReqSort.key, bizReqSort.dir]);

  if (isLoading) {
    return (
      <AppLayout title="Panel de Administración">
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  const kpiItems = [
    { title: 'Negocios', value: data?.totalBusinesses || 0, icon: Store, sub: 'registrados' },
    { title: 'Usuarios', value: data?.totalUsers || 0, icon: Users, sub: 'registrados' },
    { title: 'Ventas', value: data?.totalSales || 0, icon: ShoppingCart, sub: 'completadas' },
    { title: 'Ingresos', value: `$${(data?.totalRevenue || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}`, icon: DollarSign, sub: 'total facturado' },
  ];

  const statusBadge = (status: string) => (
    <Badge variant={status === 'approved' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary'} className="text-[11px]">
      {status === 'approved' ? 'Aprobado' : status === 'rejected' ? 'Rechazado' : 'Pendiente'}
    </Badge>
  );

  // Filter bar component
  const FilterBar = ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">{children}</div>
  );

  const SearchInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
    <div className="relative flex-1 max-w-xs">
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="pl-8 h-9 text-sm" />
    </div>
  );

  const ResultCount = ({ count, label = 'resultado' }: { count: number; label?: string }) => (
    <span className="text-xs text-muted-foreground ml-auto">{count} {label}{count !== 1 ? 's' : ''}</span>
  );

  return (
    <AppLayout title="Panel de Administración">
      <div className="space-y-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <div className="overflow-x-auto">
            <TabsList className="bg-muted/60">
              <TabsTrigger value="overview" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" /> Resumen</TabsTrigger>
              <TabsTrigger value="businesses" className="gap-1.5 text-xs"><Store className="h-3.5 w-3.5" /> Negocios</TabsTrigger>
              <TabsTrigger value="stats" className="gap-1.5 text-xs"><BarChart3 className="h-3.5 w-3.5" /> Estadísticas</TabsTrigger>
              <TabsTrigger value="requests" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" /> Sol. Planes
                {(data?.pendingRequests?.length || 0) > 0 && <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]">{data?.pendingRequests?.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="biz-requests" className="gap-1.5 text-xs">
                <Building2 className="h-3.5 w-3.5" /> Sol. Negocios
                {(data?.pendingBizRequests?.length || 0) > 0 && <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]">{data?.pendingBizRequests?.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="offers" className="gap-1.5 text-xs"><Tag className="h-3.5 w-3.5" /> Ofertas</TabsTrigger>
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
                    <Tooltip formatter={(v: number) => `$${v.toLocaleString('es-ES', { minimumFractionDigits: 2 })}`} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' }} />
                    <Area type="monotone" dataKey="ingresos" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.08)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Últimos Registros</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <div className="divide-y divide-border/60">
                  {data?.businesses.slice(0, 5).map((b) => (
                    <div key={b.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{b.name}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{b.owner_name} · {format(new Date(b.created_at), "d MMM yyyy", { locale: es })}</p>
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
            <FilterBar>
              <SearchInput value={bizSearch} onChange={setBizSearch} placeholder="Buscar negocio, dueño..." />
              <Select value={bizFilterStatus} onValueChange={setBizFilterStatus}>
                <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Estado: Todos</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                </SelectContent>
              </Select>
              <Select value={bizFilterPlan} onValueChange={setBizFilterPlan}>
                <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue placeholder="Plan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Plan: Todos</SelectItem>
                  <SelectItem value="free">Gratuito</SelectItem>
                  <SelectItem value="basic">Básico</SelectItem>
                  <SelectItem value="professional">Profesional</SelectItem>
                </SelectContent>
              </Select>
              <ResultCount count={filteredBiz.length} />
            </FilterBar>
            <Card className="border-border/60">
              <CardContent className="p-0">
                {filteredBiz.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <SortHead label="Negocio" sortKey="name" currentKey={bizSort.key} currentDir={bizSort.dir} onToggle={bizSort.toggle} />
                          <SortHead label="Dueño" sortKey="owner_name" currentKey={bizSort.key} currentDir={bizSort.dir} onToggle={bizSort.toggle} />
                          <SortHead label="Plan" sortKey="owner_plan" currentKey={bizSort.key} currentDir={bizSort.dir} onToggle={bizSort.toggle} />
                          <SortHead label="Estado" sortKey="is_active" currentKey={bizSort.key} currentDir={bizSort.dir} onToggle={bizSort.toggle} className="text-center" />
                          <SortHead label="Suc." sortKey="branch_count" currentKey={bizSort.key} currentDir={bizSort.dir} onToggle={bizSort.toggle} className="text-center" />
                          <SortHead label="Prod." sortKey="product_count" currentKey={bizSort.key} currentDir={bizSort.dir} onToggle={bizSort.toggle} className="text-center" />
                          <SortHead label="Fecha" sortKey="created_at" currentKey={bizSort.key} currentDir={bizSort.dir} onToggle={bizSort.toggle} />
                          <TableHead className="text-[11px] uppercase tracking-wide text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBiz.map((b) => (
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
                            <TableCell><Badge variant="outline" className="text-[11px]">{getPlanLabel(b.owner_plan)}</Badge></TableCell>
                            <TableCell className="text-center">
                              <Badge variant={b.is_active !== false ? 'default' : 'secondary'} className="text-[11px]">
                                {b.is_active !== false ? 'Activo' : 'Inactivo'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center text-sm">{b.branch_count}</TableCell>
                            <TableCell className="text-center text-sm">{b.product_count}</TableCell>
                            <TableCell className="text-[11px] text-muted-foreground">{format(new Date(b.created_at), "d MMM yy", { locale: es })}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditBiz(b)}><Pencil className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ id: b.id, name: b.name })}><Trash2 className="h-3.5 w-3.5" /></Button>
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
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Registros y Ventas Mensuales</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data?.monthlyData || []} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px', fontSize: '12px' }} />
                    <Bar dataKey="negocios" name="Negocios" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="ventas" name="Ventas" fill="hsl(var(--primary) / 0.6)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* PLAN REQUESTS */}
          <TabsContent value="requests" className="space-y-4 mt-0">
            <FilterBar>
              <SearchInput value={reqSearch} onChange={setReqSearch} placeholder="Buscar usuario..." />
              <Select value={reqFilterStatus} onValueChange={setReqFilterStatus}>
                <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Estado: Todos</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="approved">Aprobados</SelectItem>
                  <SelectItem value="rejected">Rechazados</SelectItem>
                </SelectContent>
              </Select>
              <ResultCount count={filteredPlanReqs.length} label="solicitud" />
            </FilterBar>
            <Card className="border-border/60">
              <CardContent className="p-0">
                {filteredPlanReqs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <SortHead label="Usuario" sortKey="user_name" currentKey={reqSort.key} currentDir={reqSort.dir} onToggle={reqSort.toggle} />
                          <SortHead label="Plan" sortKey="plan_type" currentKey={reqSort.key} currentDir={reqSort.dir} onToggle={reqSort.toggle} />
                          <SortHead label="Meses" sortKey="months" currentKey={reqSort.key} currentDir={reqSort.dir} onToggle={reqSort.toggle} />
                          <SortHead label="Total" sortKey="total_amount" currentKey={reqSort.key} currentDir={reqSort.dir} onToggle={reqSort.toggle} />
                          <SortHead label="Estado" sortKey="status" currentKey={reqSort.key} currentDir={reqSort.dir} onToggle={reqSort.toggle} />
                          <SortHead label="Fecha" sortKey="created_at" currentKey={reqSort.key} currentDir={reqSort.dir} onToggle={reqSort.toggle} />
                          <TableHead className="text-[11px] uppercase tracking-wide text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPlanReqs.map((r: any) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <p className="text-sm font-medium">{r.user_name}</p>
                              <p className="text-[11px] text-muted-foreground">{r.user_email}</p>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-[11px]">{getPlanLabel(r.plan_type)}</Badge></TableCell>
                            <TableCell className="text-sm">{r.months}m</TableCell>
                            <TableCell className="text-sm font-medium">${Number(r.total_amount).toFixed(2)}</TableCell>
                            <TableCell>{statusBadge(r.status)}</TableCell>
                            <TableCell className="text-[11px] text-muted-foreground">{format(new Date(r.created_at), "d MMM yy", { locale: es })}</TableCell>
                            <TableCell className="text-right">
                              {r.status === 'pending' && (
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10" onClick={() => approveMutation.mutate({ requestId: r.id, action: 'approved' })}><Check className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => approveMutation.mutate({ requestId: r.id, action: 'rejected' })}><X className="h-4 w-4" /></Button>
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
            <FilterBar>
              <SearchInput value={bizReqSearch} onChange={setBizReqSearch} placeholder="Buscar solicitante, nombre..." />
              <Select value={bizReqFilterStatus} onValueChange={setBizReqFilterStatus}>
                <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Estado: Todos</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="approved">Aprobados</SelectItem>
                  <SelectItem value="rejected">Rechazados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={bizReqFilterType} onValueChange={setBizReqFilterType}>
                <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tipo: Todos</SelectItem>
                  <SelectItem value="business">Negocio</SelectItem>
                  <SelectItem value="branch">Sucursal</SelectItem>
                </SelectContent>
              </Select>
              <ResultCount count={filteredBizReqs.length} label="solicitud" />
            </FilterBar>
            <Card className="border-border/60">
              <CardContent className="p-0">
                {filteredBizReqs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <SortHead label="Solicitante" sortKey="user_name" currentKey={bizReqSort.key} currentDir={bizReqSort.dir} onToggle={bizReqSort.toggle} />
                          <SortHead label="Tipo" sortKey="request_type" currentKey={bizReqSort.key} currentDir={bizReqSort.dir} onToggle={bizReqSort.toggle} />
                          <SortHead label="Nombre" sortKey="business_name" currentKey={bizReqSort.key} currentDir={bizReqSort.dir} onToggle={bizReqSort.toggle} />
                          <SortHead label="Estado" sortKey="status" currentKey={bizReqSort.key} currentDir={bizReqSort.dir} onToggle={bizReqSort.toggle} />
                          <SortHead label="Fecha" sortKey="created_at" currentKey={bizReqSort.key} currentDir={bizReqSort.dir} onToggle={bizReqSort.toggle} />
                          <TableHead className="text-[11px] uppercase tracking-wide text-right">Acción</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredBizReqs.map((r: any) => (
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
                            <TableCell>{statusBadge(r.status)}</TableCell>
                            <TableCell className="text-[11px] text-muted-foreground">{format(new Date(r.created_at), "d MMM yy", { locale: es })}</TableCell>
                            <TableCell className="text-right">
                              {r.status === 'pending' && (
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10" onClick={() => approveBizRequestMutation.mutate({ requestId: r.id, action: 'approved' })} disabled={approveBizRequestMutation.isPending}><Check className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => approveBizRequestMutation.mutate({ requestId: r.id, action: 'rejected' })} disabled={approveBizRequestMutation.isPending}><X className="h-4 w-4" /></Button>
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

          {/* OFFERS */}
          <TabsContent value="offers" className="mt-0">
            <AdminOffersTab />
          </TabsContent>
        </Tabs>

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
          <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Settings className="h-4 w-4" /> Editar Negocio</DialogTitle>
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
                  <p className="text-[11px] text-muted-foreground">{editBiz?.is_active !== false ? 'El negocio está activo' : 'El negocio está desactivado'}</p>
                </div>
                <Switch checked={editBiz?.is_active !== false} onCheckedChange={(checked) => setEditBiz((prev: any) => prev ? { ...prev, is_active: checked } : null)} />
              </div>
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
                        {br.address && <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1"><MapPin className="h-3 w-3" /> {br.address}</p>}
                      </div>
                      {!br.is_main && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => setDeleteBranchTarget({ id: br.id, name: br.name })}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {editBranches.length === 0 && <p className="text-sm text-muted-foreground py-2 text-center">Sin sucursales</p>}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditBiz(null)}>Cancelar</Button>
              <Button
                onClick={() => editBiz && updateBizMutation.mutate({ id: editBiz.id, name: editName.trim(), business_type: editType.trim(), is_active: editBiz.is_active !== false })}
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
              <AlertDialogDescription>Se eliminarán todos los datos asociados a esta sucursal.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteBranchTarget && deleteBranchMutation.mutate(deleteBranchTarget.id)}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default AdminDashboard;
