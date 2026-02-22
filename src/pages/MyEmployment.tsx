import { useState, useMemo } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Users, Loader2, Activity, Clock, Briefcase, Play, Square,
  LayoutDashboard, CalendarDays, Info, AlertTriangle, TrendingUp, CheckCircle2, XCircle,
} from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import EquipoActivoSection from '@/components/employees/EquipoActivoSection';
import CerrarJornadaGerenteModal from '@/components/employees/CerrarJornadaGerenteModal';
import { useJornadaActiva } from '@/hooks/useJornadaActiva';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import { type Skill, getWeakPoints, getAvgScore } from '@/components/employees/PerformanceChart';
import { format, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

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
  const monthKey = format(startOfMonth(new Date()), 'yyyy-MM-dd');

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

  // Fetch my jornada history (full for activity tab)
  const { data: myJornadaHistory = [] } = useQuery({
    queryKey: ['my-jornada-history', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('jornadas').select('*')
        .eq('empleado_id', profile.id)
        .order('apertura_at', { ascending: false })
        .limit(100);
      if (error) return [];
      return data || [];
    },
    enabled: !!profile?.id && !!myEmployeeRecord,
  });

  // Fetch my performance evaluation
  const { data: myEvaluation } = useQuery({
    queryKey: ['my-evaluation', myEmployeeRecord?.id, monthKey],
    queryFn: async () => {
      if (!myEmployeeRecord?.id) return null;
      const { data, error } = await supabase
        .from('employee_evaluations')
        .select('skills')
        .eq('employee_id', myEmployeeRecord.id)
        .eq('evaluation_month', monthKey)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!myEmployeeRecord?.id,
  });

  const mySkills = useMemo(() => {
    if (!myEvaluation?.skills) return [];
    return (myEvaluation.skills as unknown as Skill[]).filter(s => !s.hidden);
  }, [myEvaluation]);

  const myAvg = useMemo(() => getAvgScore(mySkills), [mySkills]);
  const myWeak = useMemo(() => getWeakPoints(mySkills), [mySkills]);
  const radarData = mySkills.map(s => ({ skill: s.name, score: s.score, fullMark: 10 }));

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

  // Punctuality stats from jornada history
  const puntualidadStats = useMemo(() => {
    if (!myJornadaHistory.length) return { total: 0, late: 0, onTime: 0, incidents: 0 };
    // Consider "late" if apertura_at hour >= 09:00 (configurable placeholder)
    let late = 0;
    let incidents = 0;
    myJornadaHistory.forEach((j: any) => {
      const hour = new Date(j.apertura_at).getHours();
      const min = new Date(j.apertura_at).getMinutes();
      if (hour > 9 || (hour === 9 && min > 15)) late++;
      if (j.incidencia) incidents++;
    });
    return {
      total: myJornadaHistory.length,
      late,
      onTime: myJornadaHistory.length - late,
      incidents,
    };
  }, [myJornadaHistory]);

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
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="w-full grid grid-cols-3 text-xs sm:text-sm">
          <TabsTrigger value="dashboard" className="gap-1">
            <LayoutDashboard className="h-3.5 w-3.5 hidden sm:block" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="actividad" className="gap-1">
            <CalendarDays className="h-3.5 w-3.5 hidden sm:block" />
            Mi Actividad
          </TabsTrigger>
          <TabsTrigger value="info" className="gap-1">
            <Info className="h-3.5 w-3.5 hidden sm:block" />
            Info Laboral
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB 1: DASHBOARD LABORAL ===== */}
        <TabsContent value="dashboard" className="space-y-4">
          {/* Jornada status */}
          <Card>
            <CardContent className="py-3 px-4">
              {jornadaActiva && myJornada ? (
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="outline" className="border-primary/30 text-primary gap-1.5 text-xs py-1 px-3">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                    </span>
                    Jornada Activa · {getJornadaElapsed(myJornada.apertura_at)}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    Desde {new Date(myJornada.apertura_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                  <span className="text-xs text-muted-foreground">Sin jornada activa</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stat cards row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            <Card>
              <CardContent className="py-3 px-3 text-center">
                <p className="text-lg sm:text-2xl font-bold">{puntualidadStats.total}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Jornadas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  <p className="text-lg sm:text-2xl font-bold">{puntualidadStats.onTime}</p>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">A tiempo</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                  <p className="text-lg sm:text-2xl font-bold">{puntualidadStats.late}</p>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Tardanzas</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  <p className="text-lg sm:text-2xl font-bold">{puntualidadStats.incidents}</p>
                </div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">Incidencias</p>
              </CardContent>
            </Card>
          </div>

          {/* Performance evaluation radar */}
          {mySkills.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Mi Evaluación
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">{myAvg.toFixed(1)}/10</Badge>
                </div>
                <span className="text-[10px] text-muted-foreground capitalize">
                  {format(startOfMonth(new Date()), 'MMMM yyyy', { locale: es })}
                </span>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="w-full h-[200px] sm:h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="65%">
                      <PolarGrid />
                      <PolarAngleAxis dataKey="skill" tick={{ fontSize: 9 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} />
                      <Tooltip contentStyle={{ fontSize: 11 }} />
                      <Radar dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                {myWeak.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <p className="text-[10px] font-medium flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3 text-destructive" />
                      Áreas a mejorar
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {myWeak.map(w => (
                        <Badge key={w.name} variant="outline" className="text-[10px] border-destructive/50 text-destructive">
                          {w.name}: {w.score}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Equipo activo (only active members shown) */}
          <EquipoActivoSection onlyActive />

          {/* Manager: employee table */}
          {canManage && hrEmployees.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4" />
                  Empleados ({hrEmployees.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Mobile cards */}
                <div className="space-y-2 md:hidden">
                  {hrEmployees.map((emp) => {
                    const empJornada = getEmployeeJornada(emp);
                    const empProfile = getProfileForEmployee(emp);
                    return (
                      <div key={emp.id} className="border rounded-lg p-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-xs">{emp.full_name}</span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Badge variant="secondary" className="text-[10px]">
                              {POSITION_OPTIONS.find(p => p.value === emp.position)?.label || emp.position}
                            </Badge>
                            {empJornada && (
                              <Badge variant="outline" className="border-primary/30 text-primary text-[10px] gap-1">
                                <span className="relative flex h-1.5 w-1.5">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary" />
                                </span>
                                {getJornadaElapsed(empJornada.apertura_at)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {empProfile && (
                          empJornada ? (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleStopJornada(emp)}>
                              <Square className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handleStartJornada(emp)} disabled={jornadaLoading === emp.id}>
                              {jornadaLoading === emp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                            </Button>
                          )
                        )}
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
                              {empProfile && (
                                empJornada ? (
                                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleStopJornada(emp)}>
                                    <Square className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button variant="ghost" size="icon" className="text-primary" onClick={() => handleStartJornada(emp)} disabled={jornadaLoading === emp.id}>
                                    {jornadaLoading === emp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                  </Button>
                                )
                              )}
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
        </TabsContent>

        {/* ===== TAB 2: MI ACTIVIDAD ===== */}
        <TabsContent value="actividad" className="space-y-4">
          {/* Punctuality summary */}
          <div className="grid grid-cols-3 gap-2">
            <Card>
              <CardContent className="py-3 px-3 text-center">
                <p className="text-lg font-bold">{puntualidadStats.total}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-3 text-center">
                <p className="text-lg font-bold text-primary">{puntualidadStats.onTime}</p>
                <p className="text-[10px] text-muted-foreground">Puntual</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-3 text-center">
                <p className="text-lg font-bold text-destructive">{puntualidadStats.late}</p>
                <p className="text-[10px] text-muted-foreground">Tarde</p>
              </CardContent>
            </Card>
          </div>

          {/* Jornada history */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4" />
                Historial de Entradas y Salidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {myJornadaHistory.length > 0 ? (
                <>
                  {/* Mobile cards */}
                  <div className="space-y-2 md:hidden">
                    {myJornadaHistory.map((j: any) => {
                      const hour = new Date(j.apertura_at).getHours();
                      const min = new Date(j.apertura_at).getMinutes();
                      const isLate = hour > 9 || (hour === 9 && min > 15);
                      return (
                        <div key={j.id} className={`border rounded-lg p-2.5 space-y-1 ${j.incidencia ? 'border-destructive/30 bg-destructive/5' : ''}`}>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">
                              {new Date(j.apertura_at).toLocaleDateString('es', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                            <div className="flex items-center gap-1">
                              {isLate && (
                                <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive">Tarde</Badge>
                              )}
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
                          {j.notas && (
                            <p className="text-[10px] text-muted-foreground italic mt-1">{j.notas}</p>
                          )}
                        </div>
                      );
                    })}
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
                          <TableHead>Puntualidad</TableHead>
                          <TableHead>Estado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {myJornadaHistory.map((j: any) => {
                          const hour = new Date(j.apertura_at).getHours();
                          const min = new Date(j.apertura_at).getMinutes();
                          const isLate = hour > 9 || (hour === 9 && min > 15);
                          return (
                            <TableRow key={j.id} className={j.incidencia ? 'bg-destructive/5' : ''}>
                              <TableCell className="text-sm">
                                {new Date(j.apertura_at).toLocaleDateString('es')}
                              </TableCell>
                              <TableCell className="text-sm">
                                {new Date(j.apertura_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
                              </TableCell>
                              <TableCell className="text-sm">
                                {j.cierre_at ? new Date(j.cierre_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '—'}
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
                                {isLate ? (
                                  <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive">Tarde</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] border-primary/50 text-primary">Puntual</Badge>
                                )}
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
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-6">No hay registros de jornadas aún.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== TAB 3: INFORMACIÓN LABORAL ===== */}
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4" />
                Información del Empleo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <p className="text-[10px] md:text-xs text-muted-foreground">Nombre completo</p>
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
                  <div className="col-span-2 sm:col-span-1">
                    <p className="text-[10px] md:text-xs text-muted-foreground">Email</p>
                    <p className="text-xs md:text-sm truncate">{myEmployeeRecord.email}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] md:text-xs text-muted-foreground">Fecha de Alta</p>
                  <p className="text-xs md:text-sm">{new Date(myEmployeeRecord.start_date).toLocaleDateString('es')}</p>
                </div>
                {myEmployeeRecord.age && (
                  <div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">Edad</p>
                    <p className="text-xs md:text-sm">{myEmployeeRecord.age} años</p>
                  </div>
                )}
                {myEmployeeRecord.license_number && (
                  <div>
                    <p className="text-[10px] md:text-xs text-muted-foreground">No. Licencia</p>
                    <p className="text-xs md:text-sm">{myEmployeeRecord.license_number}</p>
                  </div>
                )}
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
                  <div className="mt-4 pt-3 border-t">
                    <p className="text-[10px] md:text-xs text-muted-foreground mb-1.5">Sucursales Asignadas</p>
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
        </TabsContent>
      </Tabs>

      {/* Cerrar Jornada por Gerente */}
      {jornadaCerrarTarget && (
        <CerrarJornadaGerenteModal
          open={!!jornadaCerrarTarget}
          onOpenChange={(open) => { if (!open) setJornadaCerrarTarget(null); }}
          jornada={jornadaCerrarTarget.jornada}
          employeeName={jornadaCerrarTarget.name}
        />
      )}
    </AppLayout>
  );
};

export default MyEmployment;
