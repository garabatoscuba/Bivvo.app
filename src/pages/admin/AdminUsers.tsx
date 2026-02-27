import { useState, useMemo, useCallback } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Users, Search, Loader2, Trash2, Shield, RotateCcw, Clock, UserX, Pencil, Save,
  ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { differenceInDays } from 'date-fns';

type AppRole = Database['public']['Enums']['app_role'];
type SortDir = 'asc' | 'desc';

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin', owner: 'Dueño', manager: 'Gerente',
  seller: 'Vendedor', accountant: 'Contable', affiliated: 'Afiliado',
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito', basic: 'Básico', professional: 'Profesional',
};

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

const AdminUsers = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterPlan, setFilterPlan] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; action: 'schedule' | 'hard' } | null>(null);
  const [revertTarget, setRevertTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editSubStatus, setEditSubStatus] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Sort state
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const toggleSort = useCallback((k: string) => {
    setSortKey(prev => { if (prev === k) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return k; } setSortDir('desc'); return k; });
  }, []);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      const { data: allRoles } = await supabase.from('user_roles').select('user_id, role');
      const businessIds = [...new Set(profiles.map(p => p.business_id).filter(Boolean))];
      const { data: businesses } = await supabase.from('businesses').select('id, name').in('id', businessIds.length > 0 ? businessIds : ['none']);
      const businessMap = new Map(businesses?.map(b => [b.id, b.name]) || []);
      const roleMap = new Map<string, AppRole[]>();
      allRoles?.forEach(r => { const e = roleMap.get(r.user_id) || []; e.push(r.role); roleMap.set(r.user_id, e); });
      return profiles.map(p => ({
        ...p,
        roles: roleMap.get(p.user_id) || [],
        business_name: p.business_id ? businessMap.get(p.business_id) || 'Sin nombre' : 'Sin negocio',
        primary_role: (roleMap.get(p.user_id) || [])[0] || '',
      }));
    },
  });

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: string }) => {
      const { data, error } = await supabase.functions.invoke('delete-user', { body: { user_id: userId, action } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      const msg = data?.action === 'scheduled' ? 'Usuario marcado para baja en 30 días.'
        : data?.action === 'reverted' ? 'Baja revertida correctamente.'
        : 'Usuario eliminado permanentemente.';
      toast({ title: 'Éxito', description: msg });
      setDeleteTarget(null); setRevertTarget(null);
    },
    onError: (err: any) => { toast({ title: 'Error', description: err.message, variant: 'destructive' }); setDeleteTarget(null); setRevertTarget(null); },
  });

  const openEditDialog = (u: any) => {
    setEditTarget(u); setEditName(u.full_name); setEditPlan(u.plan_type);
    setEditRole(u.roles[0] || 'owner'); setEditCountry(u.country || ''); setEditSubStatus(u.subscription_status || 'active');
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      const { error: profileErr } = await supabase.from('profiles')
        .update({ full_name: editName, plan_type: editPlan, country: editCountry || null, subscription_status: editSubStatus } as any)
        .eq('user_id', editTarget.user_id);
      if (profileErr) throw profileErr;
      const nonSuperRoles = (editTarget.roles as AppRole[]).filter((r: AppRole) => r !== 'super_admin');
      if (nonSuperRoles.length > 0) await supabase.from('user_roles').delete().eq('user_id', editTarget.user_id).in('role', nonSuperRoles);
      if (editRole !== 'super_admin') await supabase.from('user_roles').insert({ user_id: editTarget.user_id, role: editRole as AppRole });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Usuario actualizado' }); setEditTarget(null);
    } catch (err: any) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setEditSaving(false); }
  };

  // Filter + sort
  const activeUsers = useMemo(() => users?.filter(u => !u.deleted_at) || [], [users]);
  const pendingDeletion = useMemo(() => users?.filter(u => !!u.deleted_at) || [], [users]);

  const filterAndSort = useCallback((list: any[]) => {
    const q = search.toLowerCase().trim();
    let filtered = list;
    if (q) filtered = filtered.filter(u => u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.business_name.toLowerCase().includes(q));
    if (filterRole !== 'all') filtered = filtered.filter(u => u.roles.includes(filterRole));
    if (filterPlan !== 'all') filtered = filtered.filter(u => u.plan_type === filterPlan);
    return [...filtered].sort((a, b) => {
      let va: any, vb: any;
      if (sortKey === 'created_at') { va = new Date(a.created_at).getTime(); vb = new Date(b.created_at).getTime(); }
      else { va = (a[sortKey] || '').toString().toLowerCase(); vb = (b[sortKey] || '').toString().toLowerCase(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [search, filterRole, filterPlan, sortKey, sortDir]);

  const filteredActive = useMemo(() => filterAndSort(activeUsers), [filterAndSort, activeUsers]);
  const filteredPending = useMemo(() => filterAndSort(pendingDeletion), [filterAndSort, pendingDeletion]);

  const renderUserRow = (u: any, isPending: boolean) => {
    const isSuperAdmin = u.roles.includes('super_admin');
    const daysLeft = u.deletion_scheduled_at ? differenceInDays(new Date(u.deletion_scheduled_at), new Date()) : null;
    return (
      <TableRow key={u.id}>
        <TableCell>
          <p className="text-sm font-medium">{u.full_name}</p>
        </TableCell>
        <TableCell>
          <p className="text-sm text-muted-foreground">{u.email}</p>
        </TableCell>
        <TableCell className="text-sm">{u.business_name}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {u.roles.map((r: AppRole) => (
              <Badge key={r} variant={r === 'super_admin' ? 'default' : 'secondary'} className="text-[10px]">
                {r === 'super_admin' && <Shield className="mr-1 h-3 w-3" />}
                {ROLE_LABELS[r] || r}
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-[10px]">{PLAN_LABELS[u.plan_type] || u.plan_type}</Badge>
        </TableCell>
        <TableCell>
          {(() => {
            if (u.plan_type === 'free' || !u.trial_ends_at) return <span className="text-xs text-muted-foreground">—</span>;
            const trialDays = differenceInDays(new Date(u.trial_ends_at), new Date());
            if (trialDays < 0) return <Badge variant="destructive" className="text-[10px] gap-1"><Clock className="h-3 w-3" />Vencida</Badge>;
            return <Badge variant="secondary" className="text-[10px] gap-1"><Clock className="h-3 w-3" />{trialDays}d</Badge>;
          })()}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            {!isPending && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(u)}><Pencil className="h-3.5 w-3.5" /></Button>
            )}
            {isPending ? (
              <>
                <span className="text-[10px] text-muted-foreground mr-1">{daysLeft !== null && daysLeft >= 0 ? `${daysLeft}d` : 'Vencido'}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:bg-primary/10" disabled={deleteMutation.isPending} onClick={() => setRevertTarget({ id: u.user_id, name: u.full_name })}><RotateCcw className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" disabled={isSuperAdmin || deleteMutation.isPending} onClick={() => setDeleteTarget({ id: u.user_id, name: u.full_name, action: 'hard' })}><Trash2 className="h-3.5 w-3.5" /></Button>
              </>
            ) : (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" disabled={isSuperAdmin || deleteMutation.isPending} onClick={() => setDeleteTarget({ id: u.user_id, name: u.full_name, action: 'schedule' })}><UserX className="h-3.5 w-3.5" /></Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  const UserTable = ({ data: tableData, isPending }: { data: any[]; isPending: boolean }) => (
    <Card className="border-border/60">
      <CardContent className="p-0">
        {tableData.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortHead label="Nombre" sortKey="full_name" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
                  <SortHead label="Email" sortKey="email" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
                  <SortHead label="Negocio" sortKey="business_name" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
                  <SortHead label="Rol" sortKey="primary_role" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
                  <SortHead label="Plan" sortKey="plan_type" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
                  <TableHead className="text-[11px] uppercase tracking-wide">Prueba</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>{tableData.map(u => renderUserRow(u, isPending))}</TableBody>
            </Table>
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">No se encontraron usuarios</div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <AppLayout title="Gestión de Usuarios">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar nombre, email, negocio..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
          </div>
          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="w-[140px] h-9 text-sm"><SelectValue placeholder="Rol" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Rol: Todos</SelectItem>
              <SelectItem value="owner">Dueño</SelectItem>
              <SelectItem value="manager">Gerente</SelectItem>
              <SelectItem value="seller">Vendedor</SelectItem>
              <SelectItem value="accountant">Contable</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPlan} onValueChange={setFilterPlan}>
            <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue placeholder="Plan" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Plan: Todos</SelectItem>
              <SelectItem value="free">Gratuito</SelectItem>
              <SelectItem value="basic">Básico</SelectItem>
              <SelectItem value="professional">Profesional</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground ml-auto">{filteredActive.length + filteredPending.length} usuario{filteredActive.length + filteredPending.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <Tabs defaultValue="active" className="space-y-4">
            <TabsList className="bg-muted/60">
              <TabsTrigger value="active" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Activos ({filteredActive.length})</TabsTrigger>
              <TabsTrigger value="pending" className="gap-1.5 text-xs"><Clock className="h-3.5 w-3.5" /> Pendientes de baja ({filteredPending.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="active" className="mt-0"><UserTable data={filteredActive} isPending={false} /></TabsContent>
            <TabsContent value="pending" className="mt-0"><UserTable data={filteredPending} isPending={true} /></TabsContent>
          </Tabs>
        )}

        {/* Schedule/Hard Delete Dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{deleteTarget?.action === 'schedule' ? '¿Dar de baja al usuario?' : '¿Eliminar permanentemente?'}</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget?.action === 'schedule'
                  ? <>La cuenta de <strong>{deleteTarget?.name}</strong> quedará inactiva durante 30 días.</>
                  : <>Se eliminará permanentemente a <strong>{deleteTarget?.name}</strong>. Esta acción no se puede deshacer.</>
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteTarget && deleteMutation.mutate({ userId: deleteTarget.id, action: deleteTarget.action === 'schedule' ? 'schedule_deletion' : 'hard_delete' })}
                disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Procesando...' : deleteTarget?.action === 'schedule' ? 'Dar de baja' : 'Eliminar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Revert Dialog */}
        <AlertDialog open={!!revertTarget} onOpenChange={() => setRevertTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Revertir baja?</AlertDialogTitle>
              <AlertDialogDescription>La cuenta de <strong>{revertTarget?.name}</strong> volverá a estar activa.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => revertTarget && deleteMutation.mutate({ userId: revertTarget.id, action: 'revert_deletion' })} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? 'Procesando...' : 'Revertir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit User Dialog */}
        <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
          <DialogContent className="sm:max-w-sm max-h-[85dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar Usuario</DialogTitle>
              <DialogDescription>{editTarget?.email}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-sm">Nombre completo</Label>
                <Input value={editName} onChange={e => setEditName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Plan</Label>
                <Select value={editPlan} onValueChange={setEditPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Gratuito</SelectItem>
                    <SelectItem value="basic">Básico</SelectItem>
                    <SelectItem value="professional">Profesional</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Rol principal</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owner">Dueño</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="seller">Vendedor</SelectItem>
                    <SelectItem value="accountant">Contable</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">País / Región</Label>
                <Select value={editCountry} onValueChange={setEditCountry}>
                  <SelectTrigger><SelectValue placeholder="Sin definir" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cuba">🇨🇺 Cuba</SelectItem>
                    <SelectItem value="usa">🇺🇸 Estados Unidos</SelectItem>
                    <SelectItem value="americas">🌎 Américas</SelectItem>
                    <SelectItem value="europe">🇪🇺 Europa</SelectItem>
                    <SelectItem value="asia">🌏 Asia</SelectItem>
                    <SelectItem value="africa">🌍 África</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Estado</Label>
                <Select value={editSubStatus} onValueChange={setEditSubStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Activo</SelectItem>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="suspended">Suspendido</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setEditTarget(null)}>Cancelar</Button>
              <Button size="sm" onClick={handleEditSave} disabled={editSaving} className="gap-1.5">
                {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default AdminUsers;
