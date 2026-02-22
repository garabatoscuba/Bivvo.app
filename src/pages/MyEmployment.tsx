import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBranches } from '@/hooks/useBranches';
import {
  Users, UserPlus, Loader2, Pencil, Activity, Mail, MapPin,
  Clock, Briefcase, Play, Square,
} from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import EquipoActivoSection from '@/components/employees/EquipoActivoSection';
import CerrarJornadaGerenteModal from '@/components/employees/CerrarJornadaGerenteModal';
import { useJornadaActiva } from '@/hooks/useJornadaActiva';

type AppRole = Database['public']['Enums']['app_role'];

const POSITION_OPTIONS = [
  { value: 'owner', label: 'Dueño' },
  { value: 'manager', label: 'Gerente' },
  { value: 'seller', label: 'Vendedor' },
  { value: 'accountant', label: 'Contable' },
];

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
}

const MyEmployment = () => {
  const { profile, user, isOwner, isManager, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: branches = [] } = useBranches();
  const { jornadaActiva, jornada: myJornada, isLoading: jornadaLoading2 } = useJornadaActiva();
  const canManage = isOwner || isManager || isSuperAdmin;

  const [jornadaCerrarTarget, setJornadaCerrarTarget] = useState<{ jornada: any; name: string } | null>(null);
  const [jornadaLoading, setJornadaLoading] = useState<string | null>(null);

  const businessId = profile?.business_id;

  // Find current user's employee record
  const { data: myEmployeeRecord = null } = useQuery({
    queryKey: ['my-employee-record', profile?.email],
    queryFn: async () => {
      if (!profile?.email) return null;
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('email', profile.email.toLowerCase())
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data as Employee | null;
    },
    enabled: !!profile?.email,
  });

  // Fetch branch assignments
  const { data: branchAssignments = [] } = useQuery({
    queryKey: ['my-employee-branch-assignments', myEmployeeRecord?.id],
    queryFn: async () => {
      if (!myEmployeeRecord) return [];
      const { data, error } = await supabase
        .from('employee_branch_assignments')
        .select('*')
        .eq('employee_id', myEmployeeRecord.id);
      if (error) return [];
      return data;
    },
    enabled: !!myEmployeeRecord,
  });

  // Fetch HR employees (for managers)
  const { data: hrEmployees = [] } = useQuery({
    queryKey: ['hr-employees', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('business_id', businessId)
        .order('full_name');
      if (error) return [];
      return data as Employee[];
    },
    enabled: !!businessId && canManage,
  });

  // Fetch active jornadas
  const { data: activeJornadas = [] } = useQuery({
    queryKey: ['jornadas-activas-business', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data: bizBranches } = await supabase
        .from('branches').select('id').eq('business_id', businessId);
      if (!bizBranches?.length) return [];
      const { data, error } = await supabase
        .from('jornadas').select('*')
        .in('sucursal_id', bizBranches.map(b => b.id))
        .is('cierre_at', null);
      if (error) return [];
      return data || [];
    },
    enabled: !!businessId && canManage,
    refetchInterval: 60000,
  });

  // Fetch employee profiles
  const employeeEmails = hrEmployees.filter(e => e.email).map(e => e.email!.toLowerCase());
  const { data: employeeProfiles = [] } = useQuery({
    queryKey: ['employee-profiles-by-email', employeeEmails.sort().join(',')],
    queryFn: async () => {
      if (!employeeEmails.length) return [];
      const { data, error } = await supabase.rpc('get_profiles_by_emails', { emails: employeeEmails });
      if (error) return [];
      return data || [];
    },
    enabled: employeeEmails.length > 0 && canManage,
  });

  // Fetch my jornada history
  const { data: myJornadaHistory = [] } = useQuery({
    queryKey: ['my-jornada-history', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('jornadas').select('*')
        .eq('empleado_id', profile.id)
        .order('apertura_at', { ascending: false })
        .limit(20);
      if (error) return [];
      return data || [];
    },
    enabled: !!profile?.id && !!myEmployeeRecord,
  });

  const getProfileForEmployee = (emp: Employee) => {
    if (!emp.email) return null;
    return employeeProfiles.find(p => p.email.toLowerCase() === emp.email!.toLowerCase()) || null;
  };

  const getEmployeeJornada = (emp: Employee) => {
    const prof = getProfileForEmployee(emp);
    if (!prof) return null;
    return activeJornadas.find((j: any) => j.empleado_id === prof.id) || null;
  };

  const getJornadaElapsed = (aperturaAt: string) => {
    const diffMs = Date.now() - new Date(aperturaAt).getTime();
    const m = Math.floor(diffMs / 60000);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
  };

  const getEmployeeBranches = (empId: string) => {
    return branchAssignments
      .filter(a => a.employee_id === empId)
      .map(a => branches.find(b => b.id === a.branch_id))
      .filter(Boolean);
  };

  const handleStartJornada = async (emp: Employee) => {
    const prof = getProfileForEmployee(emp);
    if (!prof) { sonnerToast.error('Este empleado no tiene cuenta vinculada'); return; }
    const branchId = emp.branch_id || profile?.branch_id;
    if (!branchId) { sonnerToast.error('No se puede determinar la sucursal'); return; }
    setJornadaLoading(emp.id);
    const { error } = await supabase.from('jornadas').insert({
      empleado_id: prof.id, sucursal_id: branchId, metodo_apertura: 'manual_gerente',
    });
    setJornadaLoading(null);
    if (error) { sonnerToast.error(error.message); }
    else {
      sonnerToast.success(`Jornada iniciada para ${emp.full_name}`);
      queryClient.invalidateQueries({ queryKey: ['jornadas-activas-business'] });
      queryClient.invalidateQueries({ queryKey: ['equipo-activo'] });
    }
  };

  const handleStopJornada = (emp: Employee) => {
    const jornada = getEmployeeJornada(emp);
    if (jornada) setJornadaCerrarTarget({ jornada, name: emp.full_name });
  };

  if (!myEmployeeRecord) {
    return (
      <AppLayout title="Mi Empleo">
        <div className="flex flex-col items-center justify-center py-16">
          <Briefcase className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">No tienes un registro de empleo asociado.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Mi Empleo">
      <div className="space-y-4 md:space-y-6">
        {/* Equipo activo - visible for managers/owners */}
        {canManage && <EquipoActivoSection />}

        {/* Employee info card */}
        <Card>
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="flex items-center gap-2 text-sm md:text-base">
              <Briefcase className="h-4 w-4" />
              Mi Información Laboral
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:gap-4">
              <div>
                <p className="text-[10px] md:text-xs text-muted-foreground">Nombre</p>
                <p className="text-sm font-medium truncate">{myEmployeeRecord.full_name}</p>
              </div>
              <div>
                <p className="text-[10px] md:text-xs text-muted-foreground">Puesto</p>
                <Badge variant="secondary" className="text-[10px] md:text-xs">
                  {POSITION_OPTIONS.find(p => p.value === myEmployeeRecord.position)?.label || myEmployeeRecord.position}
                </Badge>
              </div>
              <div>
                <p className="text-[10px] md:text-xs text-muted-foreground">No. de Contrato</p>
                <p className="text-xs md:text-sm">{myEmployeeRecord.contract_number}</p>
              </div>
              <div>
                <p className="text-[10px] md:text-xs text-muted-foreground">CI</p>
                <p className="text-xs md:text-sm">{myEmployeeRecord.ci}</p>
              </div>
              {myEmployeeRecord.email && (
                <div className="col-span-2 md:col-span-1">
                  <p className="text-[10px] md:text-xs text-muted-foreground">Email</p>
                  <p className="text-xs md:text-sm truncate">{myEmployeeRecord.email}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] md:text-xs text-muted-foreground">Fecha de Alta</p>
                <p className="text-xs md:text-sm">{myEmployeeRecord.start_date}</p>
              </div>
              {myEmployeeRecord.address && (
                <div className="col-span-2">
                  <p className="text-[10px] md:text-xs text-muted-foreground">Dirección</p>
                  <p className="text-xs md:text-sm">{myEmployeeRecord.address}</p>
                </div>
              )}
            </div>

            {/* Sucursales asignadas */}
            {(() => {
              const myBranches = getEmployeeBranches(myEmployeeRecord.id);
              return myBranches.length > 0 ? (
                <div className="mt-3">
                  <p className="text-[10px] md:text-xs text-muted-foreground mb-1">Sucursales Asignadas</p>
                  <div className="flex flex-wrap gap-1">
                    {myBranches.map(b => (
                      <Badge key={b!.id} variant="outline" className="text-[10px] md:text-xs">{b!.name}</Badge>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}
          </CardContent>
        </Card>

        {/* Jornada status */}
        <Card>
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="flex items-center gap-2 text-sm md:text-base">
              <Clock className="h-4 w-4" />
              Estado de Jornada
            </CardTitle>
          </CardHeader>
          <CardContent>
            {jornadaActiva && myJornada ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                <Badge variant="outline" className="border-primary/30 text-primary gap-1.5 text-xs md:text-sm py-1 px-3">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                  </span>
                  Jornada Activa · {getJornadaElapsed(myJornada.apertura_at)}
                </Badge>
                <p className="text-[10px] md:text-xs text-muted-foreground">
                  Iniciada: {new Date(myJornada.apertura_at).toLocaleString('es')}
                </p>
              </div>
            ) : (
              <p className="text-xs md:text-sm text-muted-foreground">No tienes jornada activa actualmente.</p>
            )}
          </CardContent>
        </Card>

        {/* Historial de jornadas propias */}
        <Card>
          <CardHeader className="pb-2 md:pb-4">
            <CardTitle className="flex items-center gap-2 text-sm md:text-base">
              <Activity className="h-4 w-4" />
              Mi Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {myJornadaHistory.length > 0 ? (
              <>
                {/* Mobile cards */}
                <div className="space-y-2 md:hidden">
                  {myJornadaHistory.map((j: any) => (
                    <div key={j.id} className="border rounded-lg p-2.5 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium">
                          {new Date(j.apertura_at).toLocaleDateString('es')}
                        </span>
                        {j.cierre_at ? (
                          j.incidencia ? (
                            <Badge variant="destructive" className="text-[10px]">Incidencia</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Cerrada</Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">Activa</Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground">
                        <div>
                          <span className="block text-muted-foreground/70">Entrada</span>
                          {new Date(j.apertura_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div>
                          <span className="block text-muted-foreground/70">Salida</span>
                          {j.cierre_at ? new Date(j.cierre_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </div>
                        <div>
                          <span className="block text-muted-foreground/70">Duración</span>
                          {j.duracion_min
                            ? `${Math.floor(j.duracion_min / 60)}h ${j.duracion_min % 60}m`
                            : j.cierre_at ? '—' : getJornadaElapsed(j.apertura_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table */}
                <div className="overflow-x-auto hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Entrada</TableHead>
                        <TableHead>Salida</TableHead>
                        <TableHead>Duración</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myJornadaHistory.map((j: any) => (
                        <TableRow key={j.id}>
                          <TableCell className="text-sm">
                            {new Date(j.apertura_at).toLocaleDateString('es')}
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(j.apertura_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                          </TableCell>
                          <TableCell className="text-sm">
                            {j.cierre_at
                              ? new Date(j.cierre_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
                              : '—'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {j.duracion_min
                              ? `${Math.floor(j.duracion_min / 60)}h ${j.duracion_min % 60}m`
                              : j.cierre_at ? '—' : getJornadaElapsed(j.apertura_at)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {j.metodo_apertura === 'manual_gerente' ? 'Gerente' : j.metodo_apertura}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {j.cierre_at ? (
                              j.incidencia ? (
                                <Badge variant="destructive" className="text-[10px]">Incidencia</Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px]">Cerrada</Badge>
                              )
                            ) : (
                              <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">Activa</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <p className="text-xs md:text-sm text-muted-foreground text-center py-4">No hay registros de jornadas aún.</p>
            )}
          </CardContent>
        </Card>

        {/* Manager/Owner: employee management */}
        {canManage && hrEmployees.length > 0 && (
          <Card>
            <CardHeader className="pb-2 md:pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm md:text-base">
                  <Users className="h-4 w-4" />
                  Empleados ({hrEmployees.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {hrEmployees.map((emp) => {
                  const empJornada = getEmployeeJornada(emp);
                  const empProfile = getProfileForEmployee(emp);
                  return (
                    <div key={emp.id} className="border rounded-lg p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs">{emp.full_name}</span>
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
                      <div className="flex justify-end gap-1">
                        {empProfile && (
                          empJornada ? (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleStopJornada(emp)} title="Detener jornada">
                              <Square className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-primary" onClick={() => handleStartJornada(emp)} disabled={jornadaLoading === emp.id} title="Iniciar jornada">
                              {jornadaLoading === emp.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop table */}
              <div className="overflow-x-auto hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Puesto</TableHead>
                      <TableHead>Jornada</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hrEmployees.map((emp) => {
                      const empJornada = getEmployeeJornada(emp);
                      const empProfile = getProfileForEmployee(emp);
                      return (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium">{emp.full_name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {POSITION_OPTIONS.find(p => p.value === emp.position)?.label || emp.position}
                            </Badge>
                          </TableCell>
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
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {empProfile && (
                                empJornada ? (
                                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleStopJornada(emp)} title="Detener">
                                    <Square className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button variant="ghost" size="icon" className="text-primary" onClick={() => handleStartJornada(emp)} disabled={jornadaLoading === emp.id} title="Iniciar">
                                    {jornadaLoading === emp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                  </Button>
                                )
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
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

export default MyEmployment;
