import { useState } from 'react';
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
import { Users, Search, Loader2, Trash2, Shield, RotateCcw, Clock, UserX, Pencil, Save } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { differenceInDays } from 'date-fns';

type AppRole = Database['public']['Enums']['app_role'];

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  owner: 'Dueño',
  manager: 'Gerente',
  seller: 'Vendedor',
  accountant: 'Contable',
  affiliated: 'Afiliado',
};

const PLAN_LABELS: Record<string, string> = {
  free: 'Gratuito',
  basic: 'Básico',
  professional: 'Profesional',
};

const AdminUsers = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; action: 'schedule' | 'hard' } | null>(null);
  const [revertTarget, setRevertTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editPlan, setEditPlan] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editCountry, setEditCountry] = useState('');
  const [editSubStatus, setEditSubStatus] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const { data: allRoles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const businessIds = [...new Set(profiles.map(p => p.business_id).filter(Boolean))];
      const { data: businesses } = await supabase
        .from('businesses')
        .select('id, name')
        .in('id', businessIds.length > 0 ? businessIds : ['none']);

      const businessMap = new Map(businesses?.map(b => [b.id, b.name]) || []);
      const roleMap = new Map<string, AppRole[]>();
      allRoles?.forEach(r => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role);
        roleMap.set(r.user_id, existing);
      });

      return profiles.map(p => ({
        ...p,
        roles: roleMap.get(p.user_id) || [],
        business_name: p.business_id ? businessMap.get(p.business_id) || 'Sin nombre' : 'Sin negocio',
      }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ userId, action }: { userId: string; action: string }) => {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: userId, action },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      const msg = data?.action === 'scheduled'
        ? 'Usuario marcado para baja en 30 días.'
        : data?.action === 'reverted'
        ? 'Baja revertida correctamente.'
        : 'Usuario eliminado permanentemente.';
      toast({ title: 'Éxito', description: msg });
      setDeleteTarget(null);
      setRevertTarget(null);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setDeleteTarget(null);
      setRevertTarget(null);
    },
  });

  const openEditDialog = (u: any) => {
    setEditTarget(u);
    setEditName(u.full_name);
    setEditPlan(u.plan_type);
    setEditRole(u.roles[0] || 'owner');
    setEditCountry(u.country || '');
    setEditSubStatus(u.subscription_status || 'active');
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      // Update profile
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({ full_name: editName, plan_type: editPlan, country: editCountry || null, subscription_status: editSubStatus } as any)
        .eq('user_id', editTarget.user_id);
      if (profileErr) throw profileErr;

      // Update role: delete existing non-super_admin roles, insert new one
      const currentRoles: AppRole[] = editTarget.roles;
      const nonSuperRoles = currentRoles.filter((r: AppRole) => r !== 'super_admin');
      if (nonSuperRoles.length > 0) {
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', editTarget.user_id)
          .in('role', nonSuperRoles);
      }
      if (editRole !== 'super_admin') {
        await supabase
          .from('user_roles')
          .insert({ user_id: editTarget.user_id, role: editRole as AppRole });
      }

      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast({ title: 'Usuario actualizado' });
      setEditTarget(null);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setEditSaving(false);
    }
  };

  const activeUsers = users?.filter(u => !u.deleted_at) || [];
  const pendingDeletion = users?.filter(u => !!u.deleted_at) || [];

  const filteredActive = activeUsers.filter(u => {
    const q = search.toLowerCase();
    return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const filteredPending = pendingDeletion.filter(u => {
    const q = search.toLowerCase();
    return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const renderUserRow = (u: any, isPending: boolean) => {
    const isSuperAdmin = u.roles.includes('super_admin');
    const daysLeft = u.deletion_scheduled_at
      ? differenceInDays(new Date(u.deletion_scheduled_at), new Date())
      : null;

    return (
      <TableRow key={u.id}>
        <TableCell className="font-medium">{u.full_name}</TableCell>
        <TableCell className="text-muted-foreground">{u.email}</TableCell>
        <TableCell>{u.business_name}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {u.roles.map((r: AppRole) => (
              <Badge key={r} variant={r === 'super_admin' ? 'default' : 'secondary'} className="text-xs">
                {r === 'super_admin' && <Shield className="mr-1 h-3 w-3" />}
                {ROLE_LABELS[r] || r}
              </Badge>
            ))}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs">
            {PLAN_LABELS[u.plan_type] || u.plan_type}
          </Badge>
        </TableCell>
        <TableCell>
          {(() => {
            if (u.plan_type === 'free' || !u.trial_ends_at) return <span className="text-xs text-muted-foreground">—</span>;
            const trialDays = differenceInDays(new Date(u.trial_ends_at), new Date());
            if (trialDays < 0) return <Badge variant="destructive" className="text-xs gap-1"><Clock className="h-3 w-3" />Vencida</Badge>;
            return <Badge variant="secondary" className="text-xs gap-1"><Clock className="h-3 w-3" />{trialDays}d restantes</Badge>;
          })()}
        </TableCell>
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-1">
            {!isPending && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => openEditDialog(u)}
                title="Editar usuario"
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {isPending ? (
              <>
                <span className="text-xs text-muted-foreground mr-1">
                  {daysLeft !== null && daysLeft >= 0 ? `${daysLeft}d` : 'Vencido'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-green-600 hover:text-green-700"
                  disabled={deleteMutation.isPending}
                  onClick={() => setRevertTarget({ id: u.user_id, name: u.full_name })}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={isSuperAdmin || deleteMutation.isPending}
                  onClick={() => setDeleteTarget({ id: u.user_id, name: u.full_name, action: 'hard' })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                disabled={isSuperAdmin || deleteMutation.isPending}
                onClick={() => setDeleteTarget({ id: u.user_id, name: u.full_name, action: 'schedule' })}
              >
                <UserX className="h-4 w-4" />
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <AppLayout title="Gestión de Usuarios">
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="active">
            <TabsList>
              <TabsTrigger value="active" className="gap-1.5">
                <Users className="h-3.5 w-3.5" /> Activos ({activeUsers.length})
              </TabsTrigger>
              <TabsTrigger value="pending" className="gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Pendientes de baja ({pendingDeletion.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active">
              <Card>
                <CardContent className="p-0">
                  {filteredActive.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Negocio</TableHead>
                            <TableHead>Roles</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead>Prueba</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredActive.map(u => renderUserRow(u, false))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <p className="mt-4 text-muted-foreground">No se encontraron usuarios</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pending">
              <Card>
                <CardContent className="p-0">
                  {filteredPending.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Negocio</TableHead>
                            <TableHead>Roles</TableHead>
                            <TableHead>Plan</TableHead>
                            <TableHead>Prueba</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPending.map(u => renderUserRow(u, true))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="py-8 text-center">
                      <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
                      <p className="mt-4 text-muted-foreground">No hay usuarios pendientes de baja</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Schedule/Hard Delete Dialog */}
        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deleteTarget?.action === 'schedule' ? '¿Dar de baja al usuario?' : '¿Eliminar permanentemente?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget?.action === 'schedule'
                  ? <>La cuenta de <strong>{deleteTarget?.name}</strong> quedará inactiva durante 30 días.</>
                  : <>Se eliminará permanentemente a <strong>{deleteTarget?.name}</strong>. Esta acción no se puede deshacer.</>
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteTarget && deleteMutation.mutate({
                  userId: deleteTarget.id,
                  action: deleteTarget.action === 'schedule' ? 'schedule_deletion' : 'hard_delete',
                })}
                disabled={deleteMutation.isPending}
              >
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
              <AlertDialogDescription>
                La cuenta de <strong>{revertTarget?.name}</strong> volverá a estar activa.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => revertTarget && deleteMutation.mutate({
                  userId: revertTarget.id,
                  action: 'revert_deletion',
                })}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Procesando...' : 'Revertir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit User Dialog */}
        <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
          <DialogContent className="sm:max-w-sm">
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
