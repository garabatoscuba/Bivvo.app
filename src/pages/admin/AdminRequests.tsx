import { useState, useMemo, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Search, Loader2, Building2, FileText, Check, X,
  ArrowUp, ArrowDown, ArrowUpDown, Clock, CheckCircle2,
  DollarSign, AlertCircle, Calendar, Mail, User,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

type SortDir = 'asc' | 'desc';

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

function sortData<T>(arr: T[], key: string, dir: SortDir, numericKeys: string[] = [], dateKeys: string[] = []): T[] {
  return [...arr].sort((a: any, b: any) => {
    // Always push pending first
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    let va: any, vb: any;
    if (dateKeys.includes(key)) { va = new Date(a[key]).getTime(); vb = new Date(b[key]).getTime(); }
    else if (numericKeys.includes(key)) { va = Number(a[key] || 0); vb = Number(b[key] || 0); }
    else { va = (a[key] || '').toString().toLowerCase(); vb = (b[key] || '').toString().toLowerCase(); }
    if (va < vb) return dir === 'asc' ? -1 : 1;
    if (va > vb) return dir === 'asc' ? 1 : -1;
    return 0;
  });
}

const SearchInput = ({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="relative flex-1 max-w-xs">
    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    <Input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="pl-8 h-9 text-sm" />
  </div>
);

const StatusTabs = ({ value, onChange, counts }: { value: string; onChange: (v: string) => void; counts: Record<string, number> }) => (
  <div className="flex items-center gap-1 rounded-lg bg-muted/60 p-1">
    {[
      { key: 'all', label: 'Todos' },
      { key: 'pending', label: 'Pendientes' },
      { key: 'approved', label: 'Aprobadas' },
      { key: 'rejected', label: 'Rechazadas' },
    ].map(tab => (
      <button
        key={tab.key}
        onClick={() => onChange(tab.key)}
        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
          value === tab.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        {tab.label}
        {(counts[tab.key] || 0) > 0 && tab.key !== 'all' && (
          <span className={`ml-1.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full text-[10px] font-semibold ${
            tab.key === 'pending' ? 'bg-destructive text-destructive-foreground' : 'bg-muted-foreground/20 text-muted-foreground'
          }`}>
            {counts[tab.key]}
          </span>
        )}
      </button>
    ))}
  </div>
);

const getPlanLabel = (plan: string | null) => {
  if (plan === 'enterprise') return 'Enterprise';
  if (plan === 'professional') return 'Profesional';
  return 'Gratuito';
};

const statusBadge = (status: string) => (
  <Badge variant={status === 'approved' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary'} className="text-[11px]">
    {status === 'approved' ? 'Aprobado' : status === 'rejected' ? 'Rechazado' : 'Pendiente'}
  </Badge>
);

const AdminRequests = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [reqSearch, setReqSearch] = useState('');
  const [reqFilterStatus, setReqFilterStatus] = useState('all');
  const reqSort = useSortToggle<string>('created_at');
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [detailPlanReq, setDetailPlanReq] = useState<any>(null);

  const [bizReqSearch, setBizReqSearch] = useState('');
  const [bizReqFilterStatus, setBizReqFilterStatus] = useState('all');
  const [bizReqFilterType, setBizReqFilterType] = useState('all');
  const bizReqSort = useSortToggle<string>('created_at');
  const [selectedBizIds, setSelectedBizIds] = useState<Set<string>>(new Set());
  const [detailBizReq, setDetailBizReq] = useState<any>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-requests-page'],
    queryFn: async () => {
      const [profiles, planRequests, businessRequests] = await Promise.all([
        supabase.from('profiles').select('id, full_name, email, user_id'),
        supabase.from('plan_requests').select('*').order('created_at', { ascending: false }),
        supabase.from('business_requests').select('*').order('created_at', { ascending: false }),
      ]);

      const allProfiles = profiles.data || [];
      const enrichReqs = (reqs: any[]) => reqs.map((r: any) => {
        const prof = allProfiles.find(p => (p as any).user_id === r.user_id);
        return { ...r, user_name: prof?.full_name || prof?.email?.split('@')[0] || 'Sin nombre', user_email: prof?.email || '' };
      });

      const planReqs = enrichReqs(planRequests.data || []);
      const bizReqs = enrichReqs(businessRequests.data || []);

      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      const approvedThisMonth = planReqs.filter((r: any) =>
        r.status === 'approved' && new Date(r.approved_at || r.created_at) >= monthStart && new Date(r.approved_at || r.created_at) <= monthEnd
      ).length + bizReqs.filter((r: any) =>
        r.status === 'approved' && new Date(r.approved_at || r.created_at) >= monthStart && new Date(r.approved_at || r.created_at) <= monthEnd
      ).length;

      const totalBilled = planReqs.filter((r: any) => r.status === 'approved').reduce((s: number, r: any) => s + Number(r.total_amount || 0), 0);

      return {
        planRequests: planReqs,
        businessRequests: bizReqs,
        pendingPlanCount: planReqs.filter((r: any) => r.status === 'pending').length,
        pendingBizCount: bizReqs.filter((r: any) => r.status === 'pending').length,
        approvedThisMonth,
        totalBilled,
        planStatusCounts: {
          all: planReqs.length,
          pending: planReqs.filter((r: any) => r.status === 'pending').length,
          approved: planReqs.filter((r: any) => r.status === 'approved').length,
          rejected: planReqs.filter((r: any) => r.status === 'rejected').length,
        },
        bizStatusCounts: {
          all: bizReqs.length,
          pending: bizReqs.filter((r: any) => r.status === 'pending').length,
          approved: bizReqs.filter((r: any) => r.status === 'approved').length,
          rejected: bizReqs.filter((r: any) => r.status === 'rejected').length,
        },
      };
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: 'approved' | 'rejected' }) => {
      const request = data?.planRequests?.find((r: any) => r.id === requestId);
      if (!request) throw new Error('Solicitud no encontrada');
      const updates: any = { status: action, approved_at: new Date().toISOString() };
      const { error: reqError } = await supabase.from('plan_requests').update(updates).eq('id', requestId);
      if (reqError) throw reqError;
      if (action === 'approved') {
        const endDate = new Date(Date.now() + (request as any).months * 30 * 24 * 60 * 60 * 1000);
        const { error: profError } = await supabase.from('profiles').update({
          plan_type: (request as any).plan_type, subscription_status: 'active',
          subscription_ends_at: endDate.toISOString(), trial_ends_at: null,
        }).eq('user_id', (request as any).user_id);
        if (profError) throw profError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-requests-page'] });
      toast({ title: 'Solicitud procesada' });
      setDetailPlanReq(null);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const approveBizRequestMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: 'approved' | 'rejected' }) => {
      const { data, error } = await supabase.functions.invoke('approve-business-request', { body: { request_id: requestId, action } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-requests-page'] });
      toast({ title: 'Solicitud procesada' });
      setDetailBizReq(null);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // Bulk mutations
  const bulkPlanMutation = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: 'approved' | 'rejected' }) => {
      let success = 0;
      for (const id of ids) {
        try {
          await approveMutation.mutateAsync({ requestId: id, action });
          success++;
        } catch { /* continue */ }
      }
      return success;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['admin-requests-page'] });
      toast({ title: `${count} solicitudes procesadas` });
      setSelectedPlanIds(new Set());
    },
  });

  const bulkBizMutation = useMutation({
    mutationFn: async ({ ids, action }: { ids: string[]; action: 'approved' | 'rejected' }) => {
      let success = 0;
      for (const id of ids) {
        try {
          await approveBizRequestMutation.mutateAsync({ requestId: id, action });
          success++;
        } catch { /* continue */ }
      }
      return success;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['admin-requests-page'] });
      toast({ title: `${count} solicitudes procesadas` });
      setSelectedBizIds(new Set());
    },
  });

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

  const pendingTotal = (data?.pendingPlanCount || 0) + (data?.pendingBizCount || 0);

  // Selection helpers
  const togglePlanSelect = (id: string) => setSelectedPlanIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleBizSelect = (id: string) => setSelectedBizIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allPlanChecked = filteredPlanReqs.length > 0 && selectedPlanIds.size === filteredPlanReqs.length;
  const allBizChecked = filteredBizReqs.length > 0 && selectedBizIds.size === filteredBizReqs.length;

  if (isLoading) {
    return (
      <AppLayout title="Solicitudes">
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Solicitudes">
      <div className="space-y-5 pb-20">
        {/* KPI Cards */}
        <div className="grid gap-3 grid-cols-3">
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pendientes</span>
                <Clock className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-semibold tracking-tight">{pendingTotal}</span>
                {pendingTotal > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{pendingTotal}</Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {data?.pendingPlanCount || 0} planes · {data?.pendingBizCount || 0} negocios
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Aprobadas este mes</span>
                <CheckCircle2 className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <span className="text-xl font-semibold tracking-tight">{data?.approvedThisMonth || 0}</span>
              <p className="text-[11px] text-muted-foreground mt-1">planes + negocios</p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total facturado</span>
                <DollarSign className="h-4 w-4 text-muted-foreground/60" />
              </div>
              <span className="text-xl font-semibold tracking-tight">
                ${(data?.totalBilled || 0).toLocaleString('es-ES', { minimumFractionDigits: 2 })}
              </span>
              <p className="text-[11px] text-muted-foreground mt-1">en solicitudes aprobadas</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="plans" className="space-y-5">
          <div className="overflow-x-auto">
            <TabsList className="bg-muted/60">
              <TabsTrigger value="plans" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" /> Sol. Planes
                {(data?.pendingPlanCount || 0) > 0 && <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]">{data?.pendingPlanCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="businesses" className="gap-1.5 text-xs">
                <Building2 className="h-3.5 w-3.5" /> Sol. Negocios
                {(data?.pendingBizCount || 0) > 0 && <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]">{data?.pendingBizCount}</Badge>}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* PLAN REQUESTS */}
          <TabsContent value="plans" className="space-y-4 mt-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
              <SearchInput value={reqSearch} onChange={setReqSearch} placeholder="Buscar usuario..." />
              <StatusTabs value={reqFilterStatus} onChange={setReqFilterStatus} counts={data?.planStatusCounts || {}} />
              <span className="text-xs text-muted-foreground ml-auto">{filteredPlanReqs.length} solicitud{filteredPlanReqs.length !== 1 ? 'es' : ''}</span>
            </div>
            <Card className="border-border/60">
              <CardContent className="p-0">
                {filteredPlanReqs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-10">
                            <Checkbox
                              checked={allPlanChecked}
                              onCheckedChange={() => allPlanChecked ? setSelectedPlanIds(new Set()) : setSelectedPlanIds(new Set(filteredPlanReqs.map((r: any) => r.id)))}
                            />
                          </TableHead>
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
                          <TableRow
                            key={r.id}
                            className={`cursor-pointer ${selectedPlanIds.has(r.id) ? 'bg-primary/5' : ''}`}
                            onClick={() => setDetailPlanReq(r)}
                          >
                            <TableCell className="w-10" onClick={e => e.stopPropagation()}>
                              <Checkbox checked={selectedPlanIds.has(r.id)} onCheckedChange={() => togglePlanSelect(r.id)} />
                            </TableCell>
                            <TableCell>
                              <p className="text-sm font-medium">{r.user_name}</p>
                              <p className="text-[11px] text-muted-foreground">{r.user_email}</p>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-[11px]">{getPlanLabel(r.plan_type)}</Badge></TableCell>
                            <TableCell className="text-sm">{r.months}m</TableCell>
                            <TableCell className="text-sm font-medium">${Number(r.total_amount).toFixed(2)}</TableCell>
                            <TableCell>{statusBadge(r.status)}</TableCell>
                            <TableCell className="text-[11px] text-muted-foreground">{format(new Date(r.created_at), "d MMM yy", { locale: es })}</TableCell>
                            <TableCell className="text-right" onClick={e => e.stopPropagation()}>
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
                  <div className="py-12 text-center text-sm text-muted-foreground">No hay solicitudes de planes</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BUSINESS REQUESTS */}
          <TabsContent value="businesses" className="space-y-4 mt-0">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
              <SearchInput value={bizReqSearch} onChange={setBizReqSearch} placeholder="Buscar solicitante, nombre..." />
              <StatusTabs value={bizReqFilterStatus} onChange={setBizReqFilterStatus} counts={data?.bizStatusCounts || {}} />
              <span className="text-xs text-muted-foreground ml-auto">{filteredBizReqs.length} solicitud{filteredBizReqs.length !== 1 ? 'es' : ''}</span>
            </div>
            <Card className="border-border/60">
              <CardContent className="p-0">
                {filteredBizReqs.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-10">
                            <Checkbox
                              checked={allBizChecked}
                              onCheckedChange={() => allBizChecked ? setSelectedBizIds(new Set()) : setSelectedBizIds(new Set(filteredBizReqs.map((r: any) => r.id)))}
                            />
                          </TableHead>
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
                          <TableRow
                            key={r.id}
                            className={`cursor-pointer ${selectedBizIds.has(r.id) ? 'bg-primary/5' : ''}`}
                            onClick={() => setDetailBizReq(r)}
                          >
                            <TableCell className="w-10" onClick={e => e.stopPropagation()}>
                              <Checkbox checked={selectedBizIds.has(r.id)} onCheckedChange={() => toggleBizSelect(r.id)} />
                            </TableCell>
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
                            <TableCell className="text-right" onClick={e => e.stopPropagation()}>
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
        </Tabs>

        {/* Floating bulk action bar - Plan Requests */}
        {selectedPlanIds.size > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg">
            <span className="text-sm font-medium">
              <CheckCircle2 className="inline h-4 w-4 mr-1.5 text-primary" />
              {selectedPlanIds.size} solicitud{selectedPlanIds.size !== 1 ? 'es' : ''} seleccionada{selectedPlanIds.size !== 1 ? 's' : ''}
            </span>
            <div className="h-5 w-px bg-border" />
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => bulkPlanMutation.mutate({ ids: Array.from(selectedPlanIds), action: 'approved' })}
              disabled={bulkPlanMutation.isPending}
            >
              <Check className="h-3.5 w-3.5" />
              Aprobar {selectedPlanIds.size}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => bulkPlanMutation.mutate({ ids: Array.from(selectedPlanIds), action: 'rejected' })}
              disabled={bulkPlanMutation.isPending}
            >
              <X className="h-3.5 w-3.5" />
              Rechazar {selectedPlanIds.size}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedPlanIds(new Set())}>Cancelar</Button>
          </div>
        )}

        {/* Floating bulk action bar - Business Requests */}
        {selectedBizIds.size > 0 && selectedPlanIds.size === 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border bg-background px-4 py-3 shadow-lg">
            <span className="text-sm font-medium">
              <CheckCircle2 className="inline h-4 w-4 mr-1.5 text-primary" />
              {selectedBizIds.size} solicitud{selectedBizIds.size !== 1 ? 'es' : ''} seleccionada{selectedBizIds.size !== 1 ? 's' : ''}
            </span>
            <div className="h-5 w-px bg-border" />
            <Button
              size="sm"
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => bulkBizMutation.mutate({ ids: Array.from(selectedBizIds), action: 'approved' })}
              disabled={bulkBizMutation.isPending}
            >
              <Check className="h-3.5 w-3.5" />
              Aprobar {selectedBizIds.size}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={() => bulkBizMutation.mutate({ ids: Array.from(selectedBizIds), action: 'rejected' })}
              disabled={bulkBizMutation.isPending}
            >
              <X className="h-3.5 w-3.5" />
              Rechazar {selectedBizIds.size}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelectedBizIds(new Set())}>Cancelar</Button>
          </div>
        )}

        {/* Plan Request Detail Sheet */}
        <Sheet open={!!detailPlanReq} onOpenChange={(open) => !open && setDetailPlanReq(null)}>
          <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
            <SheetHeader className="px-5 pt-5 pb-0">
              <SheetTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Solicitud de Plan
              </SheetTitle>
            </SheetHeader>
            {detailPlanReq && (
              <ScrollArea className="flex-1 px-5 pb-5">
                <div className="space-y-5 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {statusBadge(detailPlanReq.status)}
                    <Badge variant="outline" className="text-[11px]">{getPlanLabel(detailPlanReq.plan_type)}</Badge>
                  </div>

                  <Separator />

                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Solicitante</p>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        {(detailPlanReq.user_name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{detailPlanReq.user_name}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{detailPlanReq.user_email}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border border-border/60 p-3 text-center">
                      <p className="text-lg font-semibold">{detailPlanReq.months}m</p>
                      <p className="text-[10px] text-muted-foreground">Duración</p>
                    </div>
                    <div className="rounded-lg border border-border/60 p-3 text-center">
                      <p className="text-lg font-semibold">${Number(detailPlanReq.total_amount).toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">Total</p>
                    </div>
                  </div>

                  {detailPlanReq.partner_code && (
                    <>
                      <Separator />
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Código partner</p>
                        <Badge variant="secondary" className="text-xs">{detailPlanReq.partner_code}</Badge>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Historial</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>Creada: {format(new Date(detailPlanReq.created_at), "d MMM yyyy HH:mm", { locale: es })}</span>
                      </div>
                      {detailPlanReq.approved_at && (
                        <div className="flex items-center gap-2 text-xs">
                          <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {detailPlanReq.status === 'approved' ? 'Aprobada' : 'Rechazada'}:{' '}
                            {format(new Date(detailPlanReq.approved_at), "d MMM yyyy HH:mm", { locale: es })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {detailPlanReq.status === 'pending' && (
                    <>
                      <Separator />
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => approveMutation.mutate({ requestId: detailPlanReq.id, action: 'approved' })}
                          disabled={approveMutation.isPending}
                        >
                          <Check className="h-4 w-4" /> Aprobar
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1 gap-1.5"
                          onClick={() => approveMutation.mutate({ requestId: detailPlanReq.id, action: 'rejected' })}
                          disabled={approveMutation.isPending}
                        >
                          <X className="h-4 w-4" /> Rechazar
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            )}
          </SheetContent>
        </Sheet>

        {/* Business Request Detail Sheet */}
        <Sheet open={!!detailBizReq} onOpenChange={(open) => !open && setDetailBizReq(null)}>
          <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
            <SheetHeader className="px-5 pt-5 pb-0">
              <SheetTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-primary" />
                Solicitud de {detailBizReq?.request_type === 'business' ? 'Negocio' : 'Sucursal'}
              </SheetTitle>
            </SheetHeader>
            {detailBizReq && (
              <ScrollArea className="flex-1 px-5 pb-5">
                <div className="space-y-5 pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {statusBadge(detailBizReq.status)}
                    <Badge variant="outline" className="text-[11px]">
                      {detailBizReq.request_type === 'business' ? '🏪 Negocio' : '📍 Sucursal'}
                    </Badge>
                  </div>

                  <Separator />

                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Solicitante</p>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                        {(detailBizReq.user_name || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{detailBizReq.user_name}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{detailBizReq.user_email}</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-1.5">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Detalles</p>
                    <div className="rounded-lg border border-border/60 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Nombre</span>
                        <span className="text-sm font-medium">{detailBizReq.business_name || detailBizReq.branch_name || '—'}</span>
                      </div>
                      {detailBizReq.business_type && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Tipo</span>
                          <span className="text-sm">{detailBizReq.business_type}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {detailBizReq.admin_notes && (
                    <>
                      <Separator />
                      <div className="space-y-1">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Notas admin</p>
                        <p className="text-sm">{detailBizReq.admin_notes}</p>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div className="space-y-1">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Historial</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <span>Creada: {format(new Date(detailBizReq.created_at), "d MMM yyyy HH:mm", { locale: es })}</span>
                      </div>
                      {detailBizReq.approved_at && (
                        <div className="flex items-center gap-2 text-xs">
                          <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {detailBizReq.status === 'approved' ? 'Aprobada' : 'Rechazada'}:{' '}
                            {format(new Date(detailBizReq.approved_at), "d MMM yyyy HH:mm", { locale: es })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {detailBizReq.status === 'pending' && (
                    <>
                      <Separator />
                      <div className="flex gap-2">
                        <Button
                          className="flex-1 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => approveBizRequestMutation.mutate({ requestId: detailBizReq.id, action: 'approved' })}
                          disabled={approveBizRequestMutation.isPending}
                        >
                          <Check className="h-4 w-4" /> Aprobar
                        </Button>
                        <Button
                          variant="destructive"
                          className="flex-1 gap-1.5"
                          onClick={() => approveBizRequestMutation.mutate({ requestId: detailBizReq.id, action: 'rejected' })}
                          disabled={approveBizRequestMutation.isPending}
                        >
                          <X className="h-4 w-4" /> Rechazar
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
};

export default AdminRequests;
