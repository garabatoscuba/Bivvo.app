import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, Search, Loader2, Trash2, Shield } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  owner: 'Dueño',
  manager: 'Gerente',
  seller: 'Vendedor',
  accountant: 'Contable',
};

const AdminUsers = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // Get all profiles (super_admin can see all)
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Get all roles
      const { data: allRoles } = await supabase
        .from('user_roles')
        .select('user_id, role');

      // Get business names
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
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['admin-businesses'] });
      toast({ title: 'Usuario eliminado', description: 'El usuario ha sido eliminado correctamente.' });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: 'Error al eliminar', description: err.message, variant: 'destructive' });
      setDeleteTarget(null);
    },
  });

  const filtered = users?.filter(u => {
    const q = search.toLowerCase();
    return u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuarios ({filtered?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered && filtered.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Negocio</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((u) => {
                      const isSuperAdmin = u.roles.includes('super_admin');
                      return (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">{u.full_name}</TableCell>
                          <TableCell className="text-muted-foreground">{u.email}</TableCell>
                          <TableCell>{u.business_name}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {u.roles.map(r => (
                                <Badge key={r} variant={r === 'super_admin' ? 'default' : 'secondary'} className="text-xs">
                                  {r === 'super_admin' && <Shield className="mr-1 h-3 w-3" />}
                                  {ROLE_LABELS[r] || r}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              disabled={isSuperAdmin || deleteMutation.isPending}
                              onClick={() => setDeleteTarget({ id: u.user_id, name: u.full_name })}
                            >
                              <Trash2 className="h-4 w-4" />
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
                <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">No se encontraron usuarios</p>
              </div>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
              <AlertDialogDescription>
                Estás a punto de eliminar a <strong>{deleteTarget?.name}</strong>. Se borrarán su perfil, roles y cuenta de autenticación. Esta acción no se puede deshacer. El usuario podrá registrarse de nuevo con el mismo email.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default AdminUsers;
