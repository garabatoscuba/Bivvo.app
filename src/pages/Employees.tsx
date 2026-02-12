import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Users, UserPlus, Shield, ShieldCheck, Store, Calculator, ShoppingCart, Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const ROLE_CONFIG: Record<AppRole, { label: string; icon: typeof Shield; color: string }> = {
  super_admin: { label: 'Super Admin', icon: ShieldCheck, color: 'bg-destructive text-destructive-foreground' },
  owner: { label: 'Dueño', icon: Shield, color: 'bg-primary text-primary-foreground' },
  manager: { label: 'Gerente', icon: Store, color: 'bg-accent text-accent-foreground' },
  seller: { label: 'Vendedor', icon: ShoppingCart, color: 'bg-secondary text-secondary-foreground' },
  accountant: { label: 'Contable', icon: Calculator, color: 'bg-muted text-muted-foreground' },
};

const ASSIGNABLE_ROLES: AppRole[] = ['owner', 'manager', 'seller', 'accountant'];

const Employees = () => {
  const { profile, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ userId: string; name: string; roles: AppRole[] } | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<AppRole>('seller');

  const businessId = profile?.business_id;

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('business_id', businessId);
      if (error) throw error;

      // Fetch roles for each profile
      const enriched = await Promise.all(
        profiles.map(async (p) => {
          const { data: roles } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', p.user_id);
          return { ...p, roles: (roles || []).map(r => r.role) as AppRole[] };
        })
      );
      return enriched;
    },
    enabled: !!businessId,
  });

  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast({ title: 'Rol asignado correctamente' });
      setRoleDialogOpen(false);
      setSelectedRole('');
    },
    onError: (err: any) => {
      toast({ title: 'Error al asignar rol', description: err.message, variant: 'destructive' });
    },
  });

  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast({ title: 'Rol eliminado' });
    },
    onError: (err: any) => {
      toast({ title: 'Error al eliminar rol', description: err.message, variant: 'destructive' });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      // Create user via edge function or just create profile placeholder
      // For now, we create a profile entry that will be linked when the user signs up
      toast({ title: 'Función de invitación', description: 'Por ahora, pide al empleado que se registre y luego asígnale el rol desde aquí.' });
    },
  });

  const openRoleDialog = (emp: { user_id: string; full_name: string; roles: AppRole[] }) => {
    setSelectedUser({ userId: emp.user_id, name: emp.full_name, roles: emp.roles });
    setSelectedRole('');
    setRoleDialogOpen(true);
  };

  const handleAddRole = () => {
    if (!selectedUser || !selectedRole) return;
    addRoleMutation.mutate({ userId: selectedUser.userId, role: selectedRole });
  };

  const handleRemoveRole = (userId: string, role: AppRole) => {
    if (role === 'super_admin' && !isSuperAdmin) return;
    removeRoleMutation.mutate({ userId, role });
  };

  return (
    <AppLayout title="Empleados">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Equipo de Trabajo</h2>
            <p className="text-sm text-muted-foreground">Gestiona los miembros y sus roles</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Miembros ({employees?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : employees && employees.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.full_name}</TableCell>
                      <TableCell className="text-muted-foreground">{emp.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {emp.roles.map((role) => {
                            const config = ROLE_CONFIG[role];
                            return (
                              <Badge
                                key={role}
                                className={`${config.color} cursor-pointer`}
                                onClick={() => {
                                  if (role !== 'super_admin' || isSuperAdmin) {
                                    handleRemoveRole(emp.user_id, role);
                                  }
                                }}
                                title={role === 'super_admin' && !isSuperAdmin ? '' : 'Click para eliminar'}
                              >
                                {config.label} ✕
                              </Badge>
                            );
                          })}
                          {emp.roles.length === 0 && (
                            <span className="text-sm text-muted-foreground">Sin roles</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openRoleDialog(emp)}
                        >
                          + Rol
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center">
                <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">No hay empleados registrados</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Role Dialog */}
        <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Asignar Rol a {selectedUser?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Rol</Label>
                <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona un rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNABLE_ROLES
                      .filter(r => !selectedUser?.roles.includes(r))
                      .map(role => (
                        <SelectItem key={role} value={role}>
                          {ROLE_CONFIG[role].label}
                        </SelectItem>
                      ))}
                    {isSuperAdmin && !selectedUser?.roles.includes('super_admin') && (
                      <SelectItem value="super_admin">
                        {ROLE_CONFIG.super_admin.label}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAddRole} disabled={!selectedRole || addRoleMutation.isPending}>
                {addRoleMutation.isPending ? 'Asignando...' : 'Asignar Rol'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default Employees;
