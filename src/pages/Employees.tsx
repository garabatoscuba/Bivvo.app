import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
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
import { toast as sonnerToast } from 'sonner';
import {
  Users, UserPlus, Shield, ShieldCheck, Store, Calculator, ShoppingCart,
  Loader2, Pencil, Trash2,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const ROLE_CONFIG: Record<AppRole, { label: string; icon: typeof Shield; color: string }> = {
  super_admin: { label: 'Super Admin', icon: ShieldCheck, color: 'bg-destructive text-destructive-foreground' },
  owner: { label: 'Dueño', icon: Shield, color: 'bg-primary text-primary-foreground' },
  manager: { label: 'Gerente', icon: Store, color: 'bg-accent text-accent-foreground' },
  seller: { label: 'Vendedor', icon: ShoppingCart, color: 'bg-secondary text-secondary-foreground' },
  accountant: { label: 'Contable', icon: Calculator, color: 'bg-muted text-muted-foreground' },
};

const POSITION_OPTIONS = [
  { value: 'owner', label: 'Dueño' },
  { value: 'manager', label: 'Gerente' },
  { value: 'seller', label: 'Vendedor' },
  { value: 'accountant', label: 'Contable' },
];

const ASSIGNABLE_ROLES: AppRole[] = ['owner', 'manager', 'seller', 'accountant'];

interface Employee {
  id: string;
  business_id: string;
  branch_id: string | null;
  contract_number: string;
  full_name: string;
  age: number | null;
  ci: string;
  license_number: string | null;
  address: string | null;
  position: string;
  start_date: string;
  created_at: string;
  updated_at: string;
}

interface EmployeeForm {
  contract_number: string;
  full_name: string;
  age: string;
  ci: string;
  license_number: string;
  address: string;
  position: string;
  start_date: string;
}

const emptyForm: EmployeeForm = {
  contract_number: '',
  full_name: '',
  age: '',
  ci: '',
  license_number: '',
  address: '',
  position: 'seller',
  start_date: new Date().toISOString().split('T')[0],
};

const Employees = () => {
  const { profile, isSuperAdmin, isOwner, isManager } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Role management state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ userId: string; name: string; roles: AppRole[] } | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');

  // Employee form state
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const businessId = profile?.business_id;
  const canManage = isOwner || isManager || isSuperAdmin;

  // Fetch HR employees
  const { data: hrEmployees = [], isLoading: loadingHR } = useQuery({
    queryKey: ['hr-employees', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('business_id', businessId)
        .order('full_name');
      if (error) throw error;
      return data as Employee[];
    },
    enabled: !!businessId,
  });

  // Fetch auth-based team members (existing logic)
  const { data: teamMembers = [], isLoading: loadingTeam } = useQuery({
    queryKey: ['employees', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('business_id', businessId);
      if (error) throw error;

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

  // Role mutations (existing)
  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
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
      const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
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

  // Employee CRUD
  const handleSaveEmployee = async () => {
    if (!form.contract_number.trim() || !form.full_name.trim() || !form.ci.trim()) {
      sonnerToast.error('No. de contrato, nombre y CI son obligatorios');
      return;
    }
    if (!businessId) return;

    setSaving(true);
    try {
      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update({
            contract_number: form.contract_number.trim(),
            full_name: form.full_name.trim(),
            age: form.age ? parseInt(form.age) : null,
            ci: form.ci.trim(),
            license_number: form.license_number.trim() || null,
            address: form.address.trim() || null,
            position: form.position,
            start_date: form.start_date,
          })
          .eq('id', editingEmployee.id);
        if (error) throw error;
        sonnerToast.success('Empleado actualizado');
      } else {
        const { error } = await supabase
          .from('employees')
          .insert({
            business_id: businessId,
            branch_id: profile?.branch_id || null,
            contract_number: form.contract_number.trim(),
            full_name: form.full_name.trim(),
            age: form.age ? parseInt(form.age) : null,
            ci: form.ci.trim(),
            license_number: form.license_number.trim() || null,
            address: form.address.trim() || null,
            position: form.position,
            start_date: form.start_date,
          });
        if (error) throw error;
        sonnerToast.success('Empleado registrado');
      }
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      setEmployeeDialogOpen(false);
      setEditingEmployee(null);
      setForm(emptyForm);
    } catch (err: any) {
      sonnerToast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) {
      sonnerToast.error(error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      sonnerToast.success('Empleado eliminado');
    }
  };

  const openAddEmployee = () => {
    setEditingEmployee(null);
    setForm(emptyForm);
    setEmployeeDialogOpen(true);
  };

  const openEditEmployee = (emp: Employee) => {
    setEditingEmployee(emp);
    setForm({
      contract_number: emp.contract_number,
      full_name: emp.full_name,
      age: emp.age?.toString() || '',
      ci: emp.ci,
      license_number: emp.license_number || '',
      address: emp.address || '',
      position: emp.position,
      start_date: emp.start_date,
    });
    setEmployeeDialogOpen(true);
  };

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

  const updateField = (field: keyof EmployeeForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <AppLayout title="Empleados">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Equipo de Trabajo</h2>
            <p className="text-sm text-muted-foreground">Gestiona los miembros y sus roles</p>
          </div>
          {canManage && (
            <Button onClick={openAddEmployee}>
              <UserPlus className="h-4 w-4 mr-2" />
              Agregar Empleado
            </Button>
          )}
        </div>

        {/* HR Employees Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Empleados ({hrEmployees.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingHR ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : hrEmployees.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No. Contrato</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Edad</TableHead>
                      <TableHead>CI</TableHead>
                      <TableHead>No. Licencia</TableHead>
                      <TableHead>Dirección</TableHead>
                      <TableHead>Puesto</TableHead>
                      <TableHead>Alta</TableHead>
                      {canManage && <TableHead className="text-right">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hrEmployees.map((emp) => (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.contract_number}</TableCell>
                        <TableCell>{emp.full_name}</TableCell>
                        <TableCell>{emp.age ?? '—'}</TableCell>
                        <TableCell>{emp.ci}</TableCell>
                        <TableCell>{emp.license_number || '—'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{emp.address || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {POSITION_OPTIONS.find(p => p.value === emp.position)?.label || emp.position}
                          </Badge>
                        </TableCell>
                        <TableCell>{emp.start_date}</TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditEmployee(emp)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteEmployee(emp.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-8 text-center">
                <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">No hay empleados registrados</p>
                {canManage && (
                  <Button variant="outline" className="mt-2" onClick={openAddEmployee}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Agregar el primero
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team members with system roles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Usuarios del Sistema ({teamMembers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTeam ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : teamMembers.length > 0 ? (
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
                  {teamMembers.map((emp) => (
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
                        <Button variant="outline" size="sm" onClick={() => openRoleDialog(emp)}>
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
                <p className="mt-4 text-muted-foreground">No hay usuarios del sistema</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Employee Dialog */}
        <Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingEmployee ? 'Editar Empleado' : 'Agregar Empleado'}</DialogTitle>
              <DialogDescription>
                {editingEmployee ? 'Actualiza los datos del empleado.' : 'Completa los datos del nuevo empleado.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contract_number">No. de Contrato *</Label>
                  <Input id="contract_number" value={form.contract_number} onChange={(e) => updateField('contract_number', e.target.value)} placeholder="CTR-001" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ci">CI *</Label>
                  <Input id="ci" value={form.ci} onChange={(e) => updateField('ci', e.target.value)} placeholder="Carnet de identidad" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Nombre y Apellidos *</Label>
                <Input id="full_name" value={form.full_name} onChange={(e) => updateField('full_name', e.target.value)} placeholder="Nombre completo" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age">Edad</Label>
                  <Input id="age" type="number" value={form.age} onChange={(e) => updateField('age', e.target.value)} placeholder="25" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="license_number">No. de Licencia</Label>
                  <Input id="license_number" value={form.license_number} onChange={(e) => updateField('license_number', e.target.value)} placeholder="Opcional" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Dirección Particular</Label>
                <Input id="address" value={form.address} onChange={(e) => updateField('address', e.target.value)} placeholder="Dirección del empleado" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="position">Puesto de Trabajo *</Label>
                  <Select value={form.position} onValueChange={(v) => updateField('position', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona puesto" />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITION_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="start_date">Fecha de Alta *</Label>
                  <Input id="start_date" type="date" value={form.start_date} onChange={(e) => updateField('start_date', e.target.value)} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEmployeeDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveEmployee} disabled={saving}>
                {saving ? 'Guardando...' : editingEmployee ? 'Guardar cambios' : 'Registrar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
              <Button variant="outline" onClick={() => setRoleDialogOpen(false)}>Cancelar</Button>
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
