import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type SubscriptionStatus = Database['public']['Enums']['subscription_status'];

const STATUS_CONFIG: Record<SubscriptionStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: typeof CheckCircle }> = {
  active: { label: 'Activo', variant: 'default', icon: CheckCircle },
  pending: { label: 'Pendiente', variant: 'secondary', icon: Clock },
  suspended: { label: 'Suspendido', variant: 'destructive', icon: XCircle },
  cancelled: { label: 'Cancelado', variant: 'outline', icon: Ban },
};

const AdminBusinesses = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [newBusiness, setNewBusiness] = useState({ name: '', ownerEmail: '' });

  const { data: businesses, isLoading } = useQuery({
    queryKey: ['admin-businesses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Enrich with owner info and counts
      const enriched = await Promise.all(
        data.map(async (b) => {
          const { data: owner } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', b.owner_id ?? '')
            .maybeSingle();

          const { count: branchCount } = await supabase
            .from('branches')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', b.id);

          const { count: productCount } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('business_id', b.id);

          return {
            ...b,
            owner_name: owner?.full_name || 'Sin dueño',
            owner_email: owner?.email || '',
            branch_count: branchCount || 0,
            product_count: productCount || 0,
          };
        })
      );
      return enriched;
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

      // Create a default main branch
      const { error: branchError } = await supabase
        .from('branches')
        .insert({ business_id: data.id, name: 'Principal', is_main: true });
      if (branchError) throw branchError;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-businesses'] });
      toast({ title: 'Negocio creado', description: 'El negocio ha sido registrado exitosamente.' });
      setCreateOpen(false);
      setNewBusiness({ name: '', ownerEmail: '' });
    },
    onError: (err: any) => {
      toast({ title: 'Error al crear negocio', description: err.message, variant: 'destructive' });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: SubscriptionStatus }) => {
      const { error } = await supabase
        .from('businesses')
        .update({ subscription_status: newStatus })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-businesses'] });
      toast({ title: 'Estado actualizado' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const filtered = businesses?.filter((b) => {
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

  const getNextStatuses = (current: SubscriptionStatus): { label: string; status: SubscriptionStatus }[] => {
    switch (current) {
      case 'pending': return [{ label: 'Activar', status: 'active' }, { label: 'Cancelar', status: 'cancelled' }];
      case 'active': return [{ label: 'Suspender', status: 'suspended' }, { label: 'Cancelar', status: 'cancelled' }];
      case 'suspended': return [{ label: 'Reactivar', status: 'active' }, { label: 'Cancelar', status: 'cancelled' }];
      case 'cancelled': return [{ label: 'Reactivar', status: 'active' }];
    }
  };

  return (
    <AppLayout title="Gestión de Negocios">
      <div className="space-y-6">
        {/* Toolbar */}
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

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Negocios Registrados ({filtered?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered && filtered.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Negocio</TableHead>
                    <TableHead>Dueño</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-center">Sucursales</TableHead>
                    <TableHead className="text-center">Productos</TableHead>
                    <TableHead>Registro</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                            <Building2 className="h-4 w-4 text-primary" />
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
                      <TableCell>{getStatusBadge(b.subscription_status)}</TableCell>
                      <TableCell className="text-center">{b.branch_count}</TableCell>
                      <TableCell className="text-center">{b.product_count}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(b.created_at).toLocaleDateString('es-ES')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {getNextStatuses(b.subscription_status).map((action) => (
                            <Button
                              key={action.status}
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleStatusMutation.mutate({ id: b.id, newStatus: action.status })}
                              disabled={toggleStatusMutation.isPending}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="py-8 text-center">
                <Store className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">No se encontraron negocios</p>
              </div>
            )}
          </CardContent>
        </Card>

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
                  onChange={(e) => setNewBusiness(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => createMutation.mutate({ name: newBusiness.name })}
                disabled={!newBusiness.name.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creando...' : 'Crear Negocio'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default AdminBusinesses;
