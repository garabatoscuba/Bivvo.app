import { useState, useMemo, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Search, Loader2, Building2, FileText, Check, X,
  ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
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

const ResultCount = ({ count, label = 'resultado' }: { count: number; label?: string }) => (
  <span className="text-xs text-muted-foreground ml-auto">{count} {label}{count !== 1 ? 's' : ''}</span>
);

const FilterBar = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">{children}</div>
);

const AdminRequests = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
        return { ...r, user_name: prof?.full_name || 'Desconocido', user_email: prof?.email || '' };
      });

      return {
        planRequests: enrichReqs(planRequests.data || []),
        pendingPlanCount: (planRequests.data || []).filter((r: any) => r.status === 'pending').length,
        businessRequests: enrichReqs(businessRequests.data || []),
        pendingBizCount: (businessRequests.data || []).filter((r: any) => r.status === 'pending').length,
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
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-requests-page'] }); toast({ title: 'Solicitud procesada' }); },
    onError: (err: any) => { toast({ title: 'Error', description: err.message, variant: 'destructive' }); },
  });

  const approveBizRequestMutation = useMutation({
    mutationFn: async ({ requestId, action }: { requestId: string; action: 'approved' | 'rejected' }) => {
      const { data, error } = await supabase.functions.invoke('approve-business-request', { body: { request_id: requestId, action } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-requests-page'] }); toast({ title: 'Solicitud procesada' }); },
    onError: (err: any) => { toast({ title: 'Error', description: err.message, variant: 'destructive' }); },
  });

  const getPlanLabel = (plan: string | null) => {
    if (plan === 'professional') return 'Profesional';
    if (plan === 'basic') return 'Básico';
    return 'Gratuito';
  };

  const statusBadge = (status: string) => (
    <Badge variant={status === 'approved' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary'} className="text-[11px]">
      {status === 'approved' ? 'Aprobado' : status === 'rejected' ? 'Rechazado' : 'Pendiente'}
    </Badge>
  );

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

  const pendingPlanCount = data?.pendingPlanCount || 0;
  const pendingBizCount = data?.pendingBizCount || 0;

  if (isLoading) {
    return (
      <AppLayout title="Solicitudes">
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Solicitudes">
      <div className="space-y-6">
        <Tabs defaultValue="plans" className="space-y-6">
          <div className="overflow-x-auto">
            <TabsList className="bg-muted/60">
              <TabsTrigger value="plans" className="gap-1.5 text-xs">
                <FileText className="h-3.5 w-3.5" /> Sol. Planes
                {pendingPlanCount > 0 && <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]">{pendingPlanCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="businesses" className="gap-1.5 text-xs">
                <Building2 className="h-3.5 w-3.5" /> Sol. Negocios
                {pendingBizCount > 0 && <Badge variant="destructive" className="ml-1 h-4 min-w-4 px-1 text-[10px]">{pendingBizCount}</Badge>}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* PLAN REQUESTS */}
          <TabsContent value="plans" className="space-y-4 mt-0">
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
                  <div className="py-12 text-center text-sm text-muted-foreground">No hay solicitudes de planes</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BUSINESS REQUESTS */}
          <TabsContent value="businesses" className="space-y-4 mt-0">
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
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AdminRequests;
