import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { useAuditLog } from '@/hooks/useAuditLog';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { useBranches } from '@/hooks/useBranches';
import {
  Users, UserPlus, Shield, ShieldCheck, Store, Calculator, ShoppingCart,
  Loader2, Pencil, Trash2, Activity, Mail, MapPin, StopCircle, Clock,
  Play, Square, Plus, Save,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';
import PerformanceChart from '@/components/employees/PerformanceChart';
import CerrarJornadaGerenteModal from '@/components/employees/CerrarJornadaGerenteModal';
import EquipoActivoSection from '@/components/employees/EquipoActivoSection';
import HistorialJornadasTab from '@/components/employees/HistorialJornadasTab';
import { useResolvedBusinessId } from '@/hooks/useResolvedBusinessId';


type AppRole = Database['public']['Enums']['app_role'];

const ROLE_CONFIG: Record<AppRole, { label: string; icon: typeof Shield; color: string }> = {
  super_admin: { label: 'Super Admin', icon: ShieldCheck, color: 'bg-destructive text-destructive-foreground' },
  owner: { label: 'Dueño', icon: Shield, color: 'bg-primary text-primary-foreground' },
  manager: { label: 'Gerente', icon: Store, color: 'bg-accent text-accent-foreground' },
  seller: { label: 'Vendedor', icon: ShoppingCart, color: 'bg-secondary text-secondary-foreground' },
  accountant: { label: 'Contable', icon: Calculator, color: 'bg-muted text-muted-foreground' },
  affiliated: { label: 'Afiliado', icon: Users, color: 'bg-muted text-muted-foreground' },
  partner: { label: 'Partner', icon: Users, color: 'bg-muted text-muted-foreground' },
};

const POSITION_OPTIONS = [
  { value: 'owner', label: 'Dueño' },
  { value: 'manager', label: 'Gerente' },
  { value: 'seller', label: 'Vendedor' },
  { value: 'accountant', label: 'Contable' },
];

const ALL_ASSIGNABLE_ROLES: AppRole[] = ['owner', 'manager', 'seller', 'accountant'];

interface Employee {
  id: string;
  business_id: string;
  branch_id: string | null;
  contract_number: string;
  full_name: string;
  age: number | null;
  ci: string;
  email: string | null;
  license_number: string | null;
  address: string | null;
  position: string;
  start_date: string;
  created_at: string;
  updated_at: string;
  auth_user_id: string | null;
}

interface SalaryAssignmentEntry {
  modality_id: string;
  preset_id: string;
  pay_frequency: string;
  base_salary: string;
  commissions_enabled: boolean;
}

interface EmployeeForm {
  contract_number: string;
  full_name: string;
  age: string;
  ci: string;
  email: string;
  license_number: string;
  address: string;
  position: string;
  start_date: string;
  assigned_branches: string[];
  assigned_roles: AppRole[];
  salary_assignments: SalaryAssignmentEntry[];
  use_bivoo_id: boolean;
  bivoo_password: string;
  new_password: string;
  
  // Legacy single fields kept for backward compat
  modality_id: string;
  preset_id: string;
  pay_frequency: string;
  base_salary: string;
}

const emptyAssignment: SalaryAssignmentEntry = {
  modality_id: '',
  preset_id: '',
  pay_frequency: 'monthly',
  base_salary: '',
  commissions_enabled: false,
};

const emptyForm: EmployeeForm = {
  contract_number: '',
  full_name: '',
  age: '',
  ci: '',
  email: '',
  license_number: '',
  address: '',
  position: 'seller',
  start_date: new Date().toISOString().split('T')[0],
  assigned_branches: [],
  assigned_roles: ['seller'],
  salary_assignments: [],
  use_bivoo_id: true,
  bivoo_password: '',
  new_password: '',
  modality_id: '',
  preset_id: '',
  pay_frequency: 'monthly',
  base_salary: '',
};

const Employees = () => {
  const { profile, user, isSuperAdmin, isOwner, isManager } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: branches = [] } = useBranches();
  const auditLog = useAuditLog();




  // Role management state
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{ userId: string; name: string; roles: AppRole[] } | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole | ''>('');

  // Employee form state
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // Performance chart state
  const [perfEmployee, setPerfEmployee] = useState<Employee | null>(null);

  // Jornada gerente state
  const [jornadaCerrarTarget, setJornadaCerrarTarget] = useState<{ jornada: any; name: string } | null>(null);

  // Jornada start/stop loading
  const [jornadaLoading, setJornadaLoading] = useState<string | null>(null);

  const { businessId: resolvedBusinessId } = useResolvedBusinessId();
  const businessId = resolvedBusinessId || profile?.business_id;
  const canManage = isOwner || isManager || isSuperAdmin;
  const canDelete = isOwner || isSuperAdmin;
  // Managers can't assign the 'owner' role
  const ASSIGNABLE_ROLES = isOwner || isSuperAdmin
    ? ALL_ASSIGNABLE_ROLES
    : ALL_ASSIGNABLE_ROLES.filter(r => r !== 'owner');

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

  // Fetch business type
  const { data: businessData } = useQuery({
    queryKey: ['business-type', businessId],
    queryFn: async () => {
      const { data } = await supabase.from('businesses').select('business_type').eq('id', businessId!).single();
      return data;
    },
    enabled: !!businessId,
  });
  const isCopyShop = businessData?.business_type === 'copy_shop';

  // Fetch salary modalities for this business (all contexts)
  const { data: allSalaryModalities = [] } = useQuery({
    queryKey: ['salary-modalities', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('salary_modalities')
        .select('id, name, modality_type, presets, saved_configs, context')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  const salaryModalities = allSalaryModalities.filter((m: any) => !m.context || m.context === 'general');

  // Fetch branch assignments for all employees
  const { data: branchAssignments = [] } = useQuery({
    queryKey: ['employee-branch-assignments', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const employeeIds = hrEmployees.map(e => e.id);
      if (!employeeIds.length) return [];
      const { data, error } = await supabase
        .from('employee_branch_assignments')
        .select('*')
        .in('employee_id', employeeIds);
      if (error) throw error;
      return data;
    },
    enabled: !!businessId && hrEmployees.length > 0,
  });

  // Fetch active jornadas for all employees in this business
  const { data: activeJornadas = [] } = useQuery({
    queryKey: ['jornadas-activas-business', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data: bizBranches } = await supabase
        .from('branches')
        .select('id')
        .eq('business_id', businessId);
      if (!bizBranches?.length) return [];
      const branchIds = bizBranches.map(b => b.id);
      const { data, error } = await supabase
        .from('jornadas')
        .select('*')
        .in('sucursal_id', branchIds)
        .is('cierre_at', null);
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId && canManage,
    refetchInterval: 60000,
  });

  const getActiveJornada = (profileId: string) => {
    return activeJornadas.find((j: any) => j.empleado_id === profileId);
  };

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

  // Fetch profiles matching HR employee emails (cross-business lookup via SECURITY DEFINER function)
  const employeeEmails = hrEmployees.filter(e => e.email).map(e => e.email!.toLowerCase());
  const { data: employeeProfiles = [] } = useQuery({
    queryKey: ['employee-profiles-by-email', employeeEmails.sort().join(',')],
    queryFn: async () => {
      if (!employeeEmails.length) return [];
      const { data, error } = await supabase
        .rpc('get_profiles_by_emails', { emails: employeeEmails });
      if (error) { console.error('Error fetching employee profiles:', error); return []; }
      return data || [];
    },
    enabled: employeeEmails.length > 0,
  });

  // Match employee to profile by email (cross-business)
  const getProfileForEmployee = (emp: Employee) => {
    if (!emp.email) return null;
    return employeeProfiles.find(p => p.email.toLowerCase() === emp.email!.toLowerCase()) || null;
  };

  // Get active jornada for an HR employee (via profile match)
  const getEmployeeJornada = (emp: Employee) => {
    const prof = getProfileForEmployee(emp);
    if (!prof) return null;
    return getActiveJornada(prof.id);
  };

  const getJornadaElapsed = (aperturaAt: string) => {
    const diffMs = Date.now() - new Date(aperturaAt).getTime();
    const m = Math.floor(diffMs / 60000);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
  };

  const handleStartJornada = async (emp: Employee) => {
    const prof = getProfileForEmployee(emp);
    if (!prof) {
      sonnerToast.error('Este empleado no tiene cuenta vinculada');
      return;
    }
    // Use employee's assigned branch, then current user's branch as fallback
    const branchId = emp.branch_id || profile?.branch_id;
    if (!branchId) {
      sonnerToast.error('No se puede determinar la sucursal');
      return;
    }
    setJornadaLoading(emp.id);
    const { error } = await supabase.from('jornadas').insert({
      empleado_id: prof.id,
      sucursal_id: branchId,
      metodo_apertura: 'manual_gerente',
    });
    setJornadaLoading(null);
    if (error) {
      sonnerToast.error(error.message);
    } else {
      sonnerToast.success(`Jornada iniciada para ${emp.full_name}`);
      auditLog('shift_started', `Jornada iniciada en sucursal (por gerente) para ${emp.full_name}`, undefined, 'jornada');
      queryClient.invalidateQueries({ queryKey: ['jornadas-activas-business'] });
      queryClient.invalidateQueries({ queryKey: ['equipo-activo'] });
    }
  };

  const handleStopJornada = (emp: Employee) => {
    const jornada = getEmployeeJornada(emp);
    if (jornada) {
      setJornadaCerrarTarget({ jornada, name: emp.full_name });
    }
  };

  // Role mutations
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

    // Validate @bivoo.app password
    if (form.use_bivoo_id && !editingEmployee && form.bivoo_password.length < 6) {
      sonnerToast.error('La contraseña del identificador @bivoo.app debe tener al menos 6 caracteres');
      return;
    }

    setSaving(true);
    try {
      let employeeId: string;

      if (editingEmployee) {
        const { error } = await supabase
          .from('employees')
          .update({
            contract_number: form.contract_number.trim(),
            full_name: form.full_name.trim(),
            age: form.age ? parseInt(form.age) : null,
            ci: form.ci.trim(),
            email: editingEmployee.email?.endsWith('@bivoo.app') ? editingEmployee.email : (form.email.trim() || null),
            license_number: form.license_number.trim() || null,
            address: form.address.trim() || null,
            position: form.assigned_roles[0] || 'seller',
            start_date: form.start_date,
          })
          .eq('id', editingEmployee.id);
        if (error) throw error;
        employeeId = editingEmployee.id;
        sonnerToast.success('Empleado actualizado');
        auditLog('employee_edited', `Empleado ${form.full_name} editado`, editingEmployee.id, 'employee');
      } else {
        const { data, error } = await supabase
          .from('employees')
          .insert({
            business_id: businessId,
            branch_id: profile?.branch_id || null,
            contract_number: form.contract_number.trim(),
            full_name: form.full_name.trim(),
            age: form.age ? parseInt(form.age) : null,
            ci: form.ci.trim(),
            email: form.use_bivoo_id ? null : (form.email.trim() || null),
            license_number: form.license_number.trim() || null,
            address: form.address.trim() || null,
            position: form.assigned_roles[0] || 'seller',
            start_date: form.start_date,
          })
          .select('id')
          .single();
        if (error) throw error;
        employeeId = data.id;

        if (form.use_bivoo_id) {
          // Create @bivoo.app account via edge function
          try {
            const resolvedPosition = form.assigned_roles[0] || form.position || 'seller';
            const { data: bivooResult, error: bivooError } = await supabase.functions.invoke('create-bivoo-employee', {
              body: {
                full_name: form.full_name.trim(),
                password: form.bivoo_password,
                business_id: businessId,
                branch_id: profile?.branch_id || null,
                position: resolvedPosition,
                employee_id: employeeId,
              },
            });
            if (bivooError || bivooResult?.error) {
              sonnerToast.error(bivooResult?.error || bivooError?.message || 'Error al crear cuenta @bivoo.app');
            } else {
              sonnerToast.success(`Cuenta ${bivooResult.email} creada exitosamente`);
            }
          } catch (bivooErr) {
            console.error('Error creating bivoo account:', bivooErr);
            sonnerToast.error('Error al crear cuenta @bivoo.app');
          }
        } else if (form.email.trim()) {
          // Auto-link: if email matches an existing profile, assign role + business
          try {
            const { data: linkResult } = await supabase.functions.invoke('employee-onboarding', {
              body: {
                email: form.email.trim(),
                position: form.position,
                business_id: businessId,
                branch_id: profile?.branch_id || null,
              },
            });
            if (linkResult?.linked) {
              sonnerToast.success(`${form.full_name.trim()} vinculado al negocio automáticamente`);
            } else if (linkResult?.reason) {
              sonnerToast.info(linkResult.reason);
            }
          } catch (linkErr) {
            console.error('Error auto-linking employee:', linkErr);
          }
        }

        sonnerToast.success('Empleado registrado');
      }

      // Save branch assignments
      await supabase
        .from('employee_branch_assignments')
        .delete()
        .eq('employee_id', employeeId);

      if (form.assigned_branches.length > 0) {
        const assignments = form.assigned_branches.map(branchId => ({
          employee_id: employeeId,
          branch_id: branchId,
        }));
        const { error: assignError } = await supabase
          .from('employee_branch_assignments')
          .insert(assignments);
        if (assignError) throw assignError;
      }

      // Sync roles to user_roles if the employee is linked to a profile
      if (form.email.trim()) {
        const linkedProfile = employeeProfiles.find(
          p => p.email.toLowerCase() === form.email.trim().toLowerCase()
        );
        if (linkedProfile) {
          // Remove existing assignable roles
          for (const role of ASSIGNABLE_ROLES) {
            await supabase.from('user_roles').delete()
              .eq('user_id', linkedProfile.user_id)
              .eq('role', role);
          }
          // Insert selected roles
          if (form.assigned_roles.length > 0) {
            const roleInserts = form.assigned_roles.map(role => ({
              user_id: linkedProfile.user_id,
              role,
            }));
            await supabase.from('user_roles').insert(roleInserts);
          }
        }
      }

      // Save salary assignments (multiple modalities)
      const validAssignments = form.salary_assignments.filter(a => a.modality_id && a.modality_id !== 'none');
      const allValidAssignments = [...validAssignments];
      
      // Delete existing assignments for this employee
      await supabase
        .from('employee_salary_assignments')
        .delete()
        .eq('employee_id', employeeId);

      // Insert new assignments
      if (allValidAssignments.length > 0) {
        const insertPayloads = allValidAssignments.map(a => ({
          employee_id: employeeId,
          business_id: businessId,
          modality_id: a.modality_id,
          pay_frequency: a.pay_frequency as any,
          base_salary: parseFloat(a.base_salary) || 0,
          is_active: true,
          config_override: {
            ...(a.preset_id ? { preset_id: a.preset_id } : {}),
            ...(a.commissions_enabled ? { commissions_enabled: true } : {}),
          },
        }));
        const { error: insertErr } = await supabase
          .from('employee_salary_assignments')
          .insert(insertPayloads as any);
        if (insertErr) throw insertErr;
      }

      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employee-branch-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['salary-assignments-history'] });
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
    const emp = hrEmployees.find(e => e.id === id);
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) {
      sonnerToast.error(error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      sonnerToast.success('Empleado eliminado');
      auditLog('employee_deleted', `Empleado ${emp?.full_name || 'desconocido'} eliminado`, id, 'employee');
    }
  };

  const openAddEmployee = () => {
    setEditingEmployee(null);
    setForm(emptyForm);
    setEmployeeDialogOpen(true);
  };

  const openEditEmployee = async (emp: Employee) => {
    const empBranches = branchAssignments
      .filter(a => a.employee_id === emp.id)
      .map(a => a.branch_id);

    // Load current roles from user_roles if linked
    let currentRoles: AppRole[] = [emp.position as AppRole];
    if (emp.email) {
      const linkedProfile = employeeProfiles.find(
        p => p.email.toLowerCase() === emp.email!.toLowerCase()
      );
      if (linkedProfile) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', linkedProfile.user_id);
        if (roles && roles.length > 0) {
          currentRoles = roles.map(r => r.role).filter(r => ASSIGNABLE_ROLES.includes(r));
        }
      }
    }

    // Load salary assignments (multiple) - need modality context to separate
    const { data: salaryAssignments } = await supabase
      .from('employee_salary_assignments')
      .select('modality_id, pay_frequency, base_salary, config_override, salary_modalities(context)')
      .eq('employee_id', emp.id);
    
    const generalLoaded: SalaryAssignmentEntry[] = [];
    
    for (const sa of (salaryAssignments || [])) {
      const entry: SalaryAssignmentEntry = {
        modality_id: sa.modality_id || '',
        preset_id: (sa.config_override as any)?.preset_id || '',
        pay_frequency: sa.pay_frequency || 'monthly',
        base_salary: sa.base_salary ? String(sa.base_salary) : '',
        commissions_enabled: (sa.config_override as any)?.commissions_enabled || false,
      };
      generalLoaded.push(entry);
    }

    // Legacy: use first assignment for backward compat fields
    const first = generalLoaded[0];

    setEditingEmployee(emp);
    setForm({
      contract_number: emp.contract_number,
      full_name: emp.full_name,
      age: emp.age?.toString() || '',
      ci: emp.ci,
      email: emp.email || '',
      license_number: emp.license_number || '',
      address: emp.address || '',
      position: emp.position,
      start_date: emp.start_date,
      assigned_branches: empBranches,
      assigned_roles: currentRoles,
      salary_assignments: generalLoaded,
      use_bivoo_id: emp.email?.endsWith('@bivoo.app') || false,
      bivoo_password: '',
      new_password: '',
      modality_id: first?.modality_id || '',
      preset_id: first?.preset_id || '',
      pay_frequency: first?.pay_frequency || 'monthly',
      base_salary: first?.base_salary || '',
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

  const toggleBranch = (branchId: string) => {
    setForm(prev => ({
      ...prev,
      assigned_branches: prev.assigned_branches.includes(branchId)
        ? prev.assigned_branches.filter(b => b !== branchId)
        : [...prev.assigned_branches, branchId],
    }));
  };

  const getEmployeeBranches = (empId: string) => {
    return branchAssignments
      .filter(a => a.employee_id === empId)
      .map(a => branches.find(b => b.id === a.branch_id))
      .filter(Boolean);
  };

  // Determine which tabs to show
  const showMisEmpleados = canManage;

  return (
    <AppLayout title="Empleados">
      <div className="space-y-6 overflow-hidden max-w-full">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base md:text-lg font-semibold text-foreground">Equipo de Trabajo</h2>
            <p className="text-xs md:text-sm text-muted-foreground">Gestiona los miembros y sus roles</p>
          </div>
          {canManage && (
            <Button size="sm" onClick={openAddEmployee}>
              <UserPlus className="h-4 w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Agregar Empleado</span>
              <span className="sm:hidden">Agregar</span>
            </Button>
          )}
        </div>

        {/* Tabs: Mis Empleados */}
        <Tabs defaultValue="mis-empleados" className="w-full">
          <TabsList>
            {showMisEmpleados && (
              <TabsTrigger value="mis-empleados" className="gap-1.5">
                <Users className="h-4 w-4" />
                Mis Empleados
              </TabsTrigger>
            )}
          </TabsList>

          {/* ============ MIS EMPLEADOS (Owner/Manager) ============ */}
          {showMisEmpleados && (
            <TabsContent value="mis-empleados" className="space-y-6 mt-4">
              {/* Equipo activo ahora */}
              <EquipoActivoSection />

              {/* Sub-tabs: Personal / Historial */}
              <Tabs defaultValue="personal" className="w-full">
                <TabsList>
                  <TabsTrigger value="personal">Personal</TabsTrigger>
                  <TabsTrigger value="jornadas">Historial de Jornadas</TabsTrigger>
                </TabsList>

                <TabsContent value="personal" className="space-y-6 mt-4">
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
                        <>
                          {/* Mobile cards */}
                          <div className="space-y-2 md:hidden">
                            {hrEmployees.map((emp) => {
                              const empBranches = getEmployeeBranches(emp.id);
                              const empJornada = getEmployeeJornada(emp);
                              const empProfile = getProfileForEmployee(emp);
                              return (
                                <div key={emp.id} className="border rounded-lg p-3 space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm">{emp.full_name}</span>
                                    <div className="flex items-center gap-1">
                                      {empJornada && (
                                        <Badge variant="outline" className="border-primary/30 text-primary text-[10px] gap-1">
                                          <span className="relative flex h-1.5 w-1.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                                          </span>
                                          {getJornadaElapsed(empJornada.apertura_at)}
                                        </Badge>
                                      )}
                                      <Badge variant="secondary" className="text-[10px]">
                                        {POSITION_OPTIONS.find(p => p.value === emp.position)?.label || emp.position}
                                      </Badge>
                                    </div>
                                  </div>
                                  {emp.email && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                      <Mail className="h-3 w-3" />
                                      <span className="truncate">{emp.email}</span>
                                      {empProfile && <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1 border-green-500/30 text-green-600">Vinculado</Badge>}
                                    </div>
                                  )}
                                  {empBranches.length > 0 && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      <MapPin className="h-3 w-3 text-muted-foreground" />
                                      {empBranches.map(b => (
                                        <Badge key={b!.id} variant="outline" className="text-[10px] px-1.5 py-0">
                                          {b!.name}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                                    <span>CI: {emp.ci}</span>
                                    <span>Contrato: {emp.contract_number}</span>
                                    {emp.age && <span>Edad: {emp.age}</span>}
                                    <span>Alta: {emp.start_date}</span>
                                  </div>
                                  <div className="flex justify-end gap-1 pt-1">
                                    {empProfile && (
                                      empJornada ? (
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleStopJornada(emp)} title="Detener jornada">
                                          <Square className="h-3.5 w-3.5" />
                                        </Button>
                                      ) : (
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handleStartJornada(emp)} disabled={jornadaLoading === emp.id} title="Iniciar jornada">
                                          {jornadaLoading === emp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                                        </Button>
                                      )
                                    )}
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPerfEmployee(emp)} title="Evaluación de desempeño">
                                      <Activity className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditEmployee(emp)}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    {(isOwner || isSuperAdmin) && (
                                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteEmployee(emp.id)}>
                                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Desktop table */}
                          <div className="overflow-x-auto hidden md:block max-w-full">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>No. Contrato</TableHead>
                                  <TableHead>Nombre</TableHead>
                                  <TableHead>Email</TableHead>
                                  <TableHead>CI</TableHead>
                                  <TableHead>Jornada</TableHead>
                                  <TableHead>Sucursales</TableHead>
                                  <TableHead>Puesto</TableHead>
                                  <TableHead>Alta</TableHead>
                                  <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {hrEmployees.map((emp) => {
                                  const empBranches = getEmployeeBranches(emp.id);
                                  const empJornada = getEmployeeJornada(emp);
                                  const empProfile = getProfileForEmployee(emp);
                                  return (
                                    <TableRow key={emp.id}>
                                      <TableCell className="font-medium">{emp.contract_number}</TableCell>
                                      <TableCell>{emp.full_name}</TableCell>
                                      <TableCell className="text-muted-foreground">
                                        <div className="flex items-center gap-1">
                                          {emp.email || '—'}
                                          {empProfile && <Badge variant="outline" className="text-[9px] px-1 py-0 border-green-500/30 text-green-600">✓</Badge>}
                                        </div>
                                      </TableCell>
                                      <TableCell>{emp.ci}</TableCell>
                                      <TableCell>
                                        {empJornada ? (
                                          <Badge variant="outline" className="border-primary/30 text-primary text-xs gap-1">
                                            <span className="relative flex h-1.5 w-1.5">
                                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                                              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                                            </span>
                                            {getJornadaElapsed(empJornada.apertura_at)}
                                          </Badge>
                                        ) : empProfile ? (
                                          <span className="text-xs text-muted-foreground">Inactivo</span>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                          {empBranches.length > 0 ? empBranches.map(b => (
                                            <Badge key={b!.id} variant="outline" className="text-xs">
                                              {b!.name}
                                            </Badge>
                                          )) : '—'}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant="secondary">
                                          {POSITION_OPTIONS.find(p => p.value === emp.position)?.label || emp.position}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>{emp.start_date}</TableCell>
                                      <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                          {empProfile && (
                                            empJornada ? (
                                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleStopJornada(emp)} title="Detener jornada">
                                                <Square className="h-4 w-4" />
                                              </Button>
                                            ) : (
                                              <Button variant="ghost" size="icon" className="text-primary" onClick={() => handleStartJornada(emp)} disabled={jornadaLoading === emp.id} title="Iniciar jornada">
                                                {jornadaLoading === emp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                              </Button>
                                            )
                                          )}
                                          <Button variant="ghost" size="icon" onClick={() => setPerfEmployee(emp)} title="Evaluación">
                                            <Activity className="h-4 w-4" />
                                          </Button>
                                          <Button variant="ghost" size="icon" onClick={() => openEditEmployee(emp)}>
                                            <Pencil className="h-4 w-4" />
                                          </Button>
                                          {(isOwner || isSuperAdmin) && (
                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteEmployee(emp.id)}>
                                              <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                          )}
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </>
                      ) : (
                        <div className="py-8 text-center">
                          <Users className="mx-auto h-12 w-12 text-muted-foreground/50" />
                          <p className="mt-4 text-muted-foreground">No hay empleados registrados</p>
                          <Button variant="outline" className="mt-2" onClick={openAddEmployee}>
                            <UserPlus className="h-4 w-4 mr-2" />
                            Agregar el primero
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                </TabsContent>

                <TabsContent value="jornadas" className="mt-4">
                  <HistorialJornadasTab />
                </TabsContent>
              </Tabs>
            </TabsContent>
          )}



        </Tabs>

        {/* Add/Edit Employee Dialog */}
        <Dialog open={employeeDialogOpen} onOpenChange={setEmployeeDialogOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
              {/* Email / @bivoo.app toggle */}
              <div className="space-y-3">
                {!editingEmployee && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="use_bivoo_id"
                      checked={form.use_bivoo_id}
                      onCheckedChange={(checked) => setForm(prev => ({
                        ...prev,
                        use_bivoo_id: !!checked,
                        email: checked ? '' : prev.email,
                      }))}
                    />
                    <Label htmlFor="use_bivoo_id" className="text-sm font-normal cursor-pointer">
                      Crear identificador @bivoo.app (sin correo real)
                    </Label>
                  </div>
                )}
                {form.use_bivoo_id && !editingEmployee ? (
                  <div className="space-y-3 rounded-lg border border-dashed p-3">
                    <p className="text-xs text-muted-foreground">
                      Se generará automáticamente un identificador basado en el nombre: <strong>{form.full_name ? `${form.full_name.toLowerCase().replace(/\s+/g, '.')}@bivoo.app` : 'nombre@bivoo.app'}</strong>
                    </p>
                    <div className="space-y-2">
                      <Label htmlFor="bivoo_password">Contraseña Inicial *</Label>
                      <Input
                        id="bivoo_password"
                        type="password"
                        value={form.bivoo_password}
                        onChange={(e) => updateField('bivoo_password', e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        minLength={6}
                      />
                      <p className="text-xs text-muted-foreground">El empleado usará esta contraseña para entrar al sistema.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo Electrónico</Label>
                    <Input id="email" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="empleado@correo.com" disabled={editingEmployee?.email?.endsWith('@bivoo.app')} />
                    {editingEmployee?.email?.endsWith('@bivoo.app') && (
                      <p className="text-xs text-muted-foreground">Identificador @bivoo.app — no editable.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Password update for linked employees */}
              {editingEmployee?.auth_user_id && (
                <div className="space-y-2">
                  <Label htmlFor="new_password">Nueva Contraseña</Label>
                  <div className="flex gap-2">
                    <Input
                      id="new_password"
                      type="password"
                      value={form.new_password || ''}
                      onChange={(e) => setForm(prev => ({ ...prev, new_password: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                      minLength={6}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      disabled={!form.new_password || form.new_password.length < 6 || updatingPassword}
                      onClick={async () => {
                        if (!editingEmployee?.auth_user_id || !form.new_password) return;
                        setUpdatingPassword(true);
                        try {
                          const { data: sessionData } = await supabase.auth.getSession();
                          const res = await fetch(
                            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-employee-password`,
                            {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json',
                                Authorization: `Bearer ${sessionData.session?.access_token}`,
                              },
                              body: JSON.stringify({
                                auth_user_id: editingEmployee.auth_user_id,
                                new_password: form.new_password,
                              }),
                            }
                          );
                          const result = await res.json();
                          if (!res.ok) throw new Error(result.error || 'Error');
                          toast({ title: 'Contraseña actualizada' });
                          setForm(prev => ({ ...prev, new_password: '' }));
                        } catch (err: any) {
                          toast({ title: 'Error', description: err.message, variant: 'destructive' });
                        } finally {
                          setUpdatingPassword(false);
                        }
                      }}
                    >
                      {updatingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Actualizar'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Cambia la contraseña de acceso del empleado.</p>
                </div>
              )}

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
              <div className="space-y-2">
                <Label htmlFor="start_date">Fecha de Alta *</Label>
                <Input id="start_date" type="date" value={form.start_date} onChange={(e) => updateField('start_date', e.target.value)} />
              </div>

              {/* Multi-role assignment */}
              <div className="space-y-2">
                <Label>Roles del Sistema</Label>
                <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
                  {ASSIGNABLE_ROLES.map(role => {
                    const config = ROLE_CONFIG[role];
                    const Icon = config.icon;
                    return (
                      <div key={role} className="flex items-center gap-2">
                        <Checkbox
                          id={`role-${role}`}
                          checked={form.assigned_roles.includes(role)}
                          onCheckedChange={(checked) => {
                            setForm(prev => ({
                              ...prev,
                              assigned_roles: checked
                                ? [...prev.assigned_roles, role]
                                : prev.assigned_roles.filter(r => r !== role),
                            }));
                          }}
                        />
                        <Label htmlFor={`role-${role}`} className="text-sm font-normal cursor-pointer flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5" />
                          {config.label}
                        </Label>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">Los roles se asignarán cuando el empleado tenga cuenta vinculada.</p>
              </div>

              {/* Multi-branch assignment */}
              {branches.length > 0 && (
                <div className="space-y-2">
                  <Label>Sucursales Asignadas</Label>
                  <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
                    {branches.map(branch => (
                      <div key={branch.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`branch-${branch.id}`}
                          checked={form.assigned_branches.includes(branch.id)}
                          onCheckedChange={() => toggleBranch(branch.id)}
                        />
                        <Label htmlFor={`branch-${branch.id}`} className="text-sm font-normal cursor-pointer">
                          {branch.name}
                          {branch.is_main && <span className="text-muted-foreground text-xs ml-1">(Principal)</span>}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">El empleado podrá trabajar en las sucursales seleccionadas.</p>
                </div>
              )}

              {/* Salary assignments - multiple modalities */}
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Nómina</Label>
                  <div className="flex items-center gap-2">
                    {/* Load saved preset button */}
                    {(() => {
                      const allSaved = salaryModalities.flatMap((m: any) => {
                        const saved = (m.saved_configs || []) as { id: string; name: string; applies_to: string; presets: any[] }[];
                        return saved.map(s => ({ ...s, modalityId: m.id, modalityName: m.name }));
                      });
                      if (allSaved.length === 0) return null;
                      return (
                        <Select
                          value="none"
                          onValueChange={(savedId) => {
                            if (savedId === 'none') return;
                            const found = allSaved.find(s => s.id === savedId);
                            if (!found) return;
                            // Find the sub-preset to get base_salary
                            const firstPreset = found.presets?.[0];
                            setForm(prev => ({
                              ...prev,
                              salary_assignments: [
                                ...prev.salary_assignments,
                                {
                                  modality_id: found.modalityId,
                                  preset_id: firstPreset?.id || '',
                                  pay_frequency: 'monthly',
                                  base_salary: firstPreset?.config?.base_salary !== undefined
                                    ? String(firstPreset.config.base_salary)
                                    : firstPreset?.config?.hourly_rate !== undefined
                                      ? String(firstPreset.config.hourly_rate)
                                      : '',
                                  commissions_enabled: false,
                                },
                              ],
                            }));
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs w-auto gap-1">
                            <Save className="h-3.5 w-3.5" />
                            <span>Cargar preset</span>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none" disabled>Seleccionar preset...</SelectItem>
                            {allSaved.map(s => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name} <span className="text-muted-foreground ml-1">({s.modalityName})</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      );
                    })()}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setForm(prev => ({
                        ...prev,
                        salary_assignments: [...prev.salary_assignments, { ...emptyAssignment }],
                      }))}
                      disabled={form.salary_assignments.length >= salaryModalities.length}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Agregar modalidad
                    </Button>
                  </div>
                </div>

                {form.salary_assignments.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    {salaryModalities.length === 0
                      ? 'No hay modalidades activas. Configúralas en Nómina → Modalidades.'
                      : 'Sin modalidades asignadas. Agrega una o carga un preset guardado.'}
                  </p>
                )}

                {form.salary_assignments.map((assignment, idx) => {
                  const usedModalities = form.salary_assignments
                    .filter((_, i) => i !== idx)
                    .map(a => a.modality_id);
                  const availableModalities = salaryModalities.filter(
                    (m: any) => !usedModalities.includes(m.id) || m.id === assignment.modality_id
                  );
                  const selectedMod = salaryModalities.find((m: any) => m.id === assignment.modality_id);
                  const modPresets = (selectedMod as any)?.presets as { id: string; name: string; config: Record<string, any> }[] || [];

                  return (
                    <div key={idx} className="rounded-lg border p-3 space-y-3 relative">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 absolute top-2 right-2"
                        onClick={() => setForm(prev => ({
                          ...prev,
                          salary_assignments: prev.salary_assignments.filter((_, i) => i !== idx),
                        }))}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Modalidad</Label>
                          <Select
                            value={assignment.modality_id || 'none'}
                            onValueChange={(v) => setForm(prev => ({
                              ...prev,
                              salary_assignments: prev.salary_assignments.map((a, i) =>
                                i === idx ? { ...a, modality_id: v === 'none' ? '' : v, preset_id: '' } : a
                              ),
                            }))}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Seleccionar...</SelectItem>
                              {availableModalities.map((m: any) => (
                                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Frecuencia</Label>
                          <Select
                            value={assignment.pay_frequency}
                            onValueChange={(v) => setForm(prev => ({
                              ...prev,
                              salary_assignments: prev.salary_assignments.map((a, i) =>
                                i === idx ? { ...a, pay_frequency: v } : a
                              ),
                            }))}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="daily">Diaria</SelectItem>
                              <SelectItem value="weekly">Semanal</SelectItem>
                              <SelectItem value="biweekly">Quincenal</SelectItem>
                              <SelectItem value="monthly">Mensual</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {modPresets.length > 0 && (
                        <div className="space-y-1">
                          <Label className="text-xs">Preset</Label>
                          <Select
                            value={assignment.preset_id || 'none'}
                            onValueChange={(v) => {
                              const presetId = v === 'none' ? '' : v;
                              const preset = modPresets.find((p: any) => p.id === presetId);
                              setForm(prev => ({
                                ...prev,
                                salary_assignments: prev.salary_assignments.map((a, i) => {
                                  if (i !== idx) return a;
                                  const updated = { ...a, preset_id: presetId };
                                  if (preset?.config) {
                                    // Auto-fill base_salary from preset config
                                    if (preset.config.base_salary !== undefined) {
                                      updated.base_salary = String(preset.config.base_salary);
                                    }
                                    if (preset.config.hourly_rate !== undefined) {
                                      updated.base_salary = String(preset.config.hourly_rate);
                                    }
                                  }
                                  return updated;
                                }),
                              }));
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Sin preset" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sin preset</SelectItem>
                              {modPresets.map((p: any) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                  {p.config?.base_salary !== undefined && ` — $${p.config.base_salary}`}
                                  {p.config?.hourly_rate !== undefined && ` — $${p.config.hourly_rate}/h`}
                                  {p.config?.percent !== undefined && ` — ${p.config.percent}%`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      <div className="space-y-1">
                        <Label className="text-xs">Salario Base ($)</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={assignment.base_salary}
                          onChange={(e) => setForm(prev => ({
                            ...prev,
                            salary_assignments: prev.salary_assignments.map((a, i) =>
                              i === idx ? { ...a, base_salary: e.target.value } : a
                            ),
                          }))}
                          placeholder="0.00"
                          className="h-8 text-xs"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Checkbox
                          id={`comm-${idx}`}
                          checked={assignment.commissions_enabled}
                          onCheckedChange={(checked) => setForm(prev => ({
                            ...prev,
                            salary_assignments: prev.salary_assignments.map((a, i) =>
                              i === idx ? { ...a, commissions_enabled: !!checked } : a
                            ),
                          }))}
                        />
                        <Label htmlFor={`comm-${idx}`} className="text-xs font-normal cursor-pointer flex items-center gap-1">
                          <ShoppingCart className="h-3 w-3" />
                          Comisiones por productos
                        </Label>
                      </div>
                    </div>
                  );
                })}
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

        {/* Performance Chart Dialog */}
        {perfEmployee && businessId && (
          <PerformanceChart
            employeeId={perfEmployee.id}
            employeeName={perfEmployee.full_name}
            position={perfEmployee.position}
            businessId={businessId}
            branchId={perfEmployee.branch_id}
            canEdit={canManage}
            onClose={() => setPerfEmployee(null)}
          />
        )}

        {/* Cerrar Jornada por Gerente */}
        {jornadaCerrarTarget && (
          <CerrarJornadaGerenteModal
            open={!!jornadaCerrarTarget}
            onOpenChange={(open) => { if (!open) setJornadaCerrarTarget(null); }}
            jornada={jornadaCerrarTarget.jornada}
            employeeName={jornadaCerrarTarget.name}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default Employees;
