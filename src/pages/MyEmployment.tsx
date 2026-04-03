import { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useBranches } from '@/hooks/useBranches';
import {
  Users, Loader2, Activity, Clock, Briefcase, Play, Square,
  LayoutDashboard, CalendarDays, Info, AlertTriangle, TrendingUp, CheckCircle2, XCircle,
  DollarSign, ShoppingCart, Wrench, FileText, LogOut, Gift, Plus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CerrarJornadaModal from '@/components/employees/CerrarJornadaModal';
import ContarYCerrarModal from '@/components/employees/ContarYCerrarModal';
import { toast as sonnerToast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import CerrarJornadaGerenteModal from '@/components/employees/CerrarJornadaGerenteModal';
import { useJornadaActiva } from '@/hooks/useJornadaActiva';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Legend, LineChart, Line, ReferenceLine, Cell,
} from 'recharts';
import { type Skill, getWeakPoints, getAvgScore } from '@/components/employees/PerformanceChart';
import { rechartsTooltipStyle } from '@/lib/chartStyles';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, startOfMonth, subMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import PayrollHistory from '@/components/nomina/PayrollHistory';
import EmployeeSalaryView from '@/components/cobro/EmployeeSalaryView';
import MyEmploymentDashboard from '@/components/employees/MyEmploymentDashboard';
import { useDailySalary } from '@/hooks/useDailySalary';


/** Parse 'YYYY-MM-DD' as local date (avoids UTC shift) */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date to 'YYYY-MM-DD' using local components */
function formatLocalMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

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
  is_jefe?: boolean;
  is_cash_counter?: boolean;
  assigned_roles?: string[];
}

const MyEmployment = () => {
  const { profile, user, isOwner, isManager, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: branches = [] } = useBranches();
  const { jornadaActiva, jornada: myJornada, isLoading: jornadaLoading2 } = useJornadaActiva();

  const [jornadaCerrarTarget, setJornadaCerrarTarget] = useState<{ jornada: any; name: string } | null>(null);
  const [cerrarMiJornadaOpen, setCerrarMiJornadaOpen] = useState(false);
  const [contarYCerrarOpen, setContarYCerrarOpen] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [chartType, setChartType] = useState<'radar' | 'bar'>('bar');
  const [compareEmployeeId, setCompareEmployeeId] = useState<string | null>(null);
  const [evalSkills, setEvalSkills] = useState<Skill[]>([]);

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

  const businessId = myEmployeeRecord?.business_id || null;
  const monthKey = formatLocalMonthKey(selectedMonth);

  // Determine if employee needs inventory count before closing
  const employeeRoles = myEmployeeRecord?.assigned_roles || [];
  const isJefe = myEmployeeRecord?.is_jefe === true;
  const isSeller = employeeRoles.includes('seller');
  const isOperatorRole = employeeRoles.includes('operator');
  const needsCount = isJefe && (isSeller || isOperatorRole);

  // Use the shared salary hook
  const dailySalary = useDailySalary({
    businessId,
    branchId: myJornada?.sucursal_id || null,
    employeeId: myEmployeeRecord?.id || null,
    jornadaActiva: !!jornadaActiva,
    jornadaAperturaAt: myJornada?.apertura_at,
  });

  // Fetch branch assignments for info tab
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

  // Fetch salary assignment for info tab display
  const { data: mySalaryAssignment = null } = useQuery({
    queryKey: ['my-salary-assignment-info', myEmployeeRecord?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_salary_assignments')
        .select('*, salary_modalities(name, modality_type, config)')
        .eq('employee_id', myEmployeeRecord!.id)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!myEmployeeRecord?.id,
  });

  // Fetch my jornada history (for activity tab)
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

  // Fetch evaluation for selected month
  const { data: myEvaluation, isLoading: evalLoading } = useQuery({
    queryKey: ['my-evaluation', myEmployeeRecord?.id, monthKey],
    queryFn: async () => {
      if (!myEmployeeRecord?.id) return null;
      const { data, error } = await supabase
        .from('employee_evaluations')
        .select('skills, evaluation_month')
        .eq('employee_id', myEmployeeRecord.id)
        .eq('evaluation_month', monthKey)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!myEmployeeRecord?.id,
    staleTime: 0,
  });

  // Fetch evaluation history
  const { data: evalHistory = [] } = useQuery({
    queryKey: ['my-evaluation-history', myEmployeeRecord?.id],
    queryFn: async () => {
      if (!myEmployeeRecord?.id) return [];
      const { data, error } = await supabase
        .from('employee_evaluations')
        .select('evaluation_month, skills')
        .eq('employee_id', myEmployeeRecord.id)
        .order('evaluation_month', { ascending: true });
      if (error) return [];
      return data;
    },
    enabled: !!myEmployeeRecord?.id,
  });

  // Realtime subscription for evaluations
  useEffect(() => {
    if (!myEmployeeRecord?.id) return;
    const channel = supabase
      .channel('my-evaluations-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'employee_evaluations',
          filter: `employee_id=eq.${myEmployeeRecord.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['my-evaluation', myEmployeeRecord.id] });
          queryClient.invalidateQueries({ queryKey: ['my-evaluation-history', myEmployeeRecord.id] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [myEmployeeRecord?.id, queryClient]);

  // Fetch employees for comparison
  const { data: compareEmployees = [] } = useQuery({
    queryKey: ['compare-employees', businessId, myEmployeeRecord?.id],
    queryFn: async () => {
      if (!businessId || !myEmployeeRecord?.id) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('business_id', businessId)
        .neq('id', myEmployeeRecord.id)
        .order('full_name');
      if (error) return [];
      return data;
    },
    enabled: !!businessId && !!myEmployeeRecord?.id,
  });

  // Fetch comparison evaluation
  const { data: compareEvaluation } = useQuery({
    queryKey: ['compare-evaluation', compareEmployeeId, monthKey],
    queryFn: async () => {
      if (!compareEmployeeId) return null;
      const { data, error } = await supabase
        .from('employee_evaluations')
        .select('skills')
        .eq('employee_id', compareEmployeeId)
        .eq('evaluation_month', monthKey)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!compareEmployeeId,
  });

  // Sync skills state when evaluation data changes
  useEffect(() => {
    if (evalLoading) return;
    if (myEvaluation?.skills) {
      setEvalSkills(myEvaluation.skills as unknown as Skill[]);
    } else {
      setEvalSkills([]);
    }
  }, [myEvaluation, evalLoading]);

  const handleMonthChange = (direction: 'prev' | 'next') => {
    setSelectedMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  const mySkills = useMemo(() => evalSkills.filter(s => !s.hidden), [evalSkills]);
  const myAvg = useMemo(() => getAvgScore(evalSkills), [evalSkills]);
  const myWeak = useMemo(() => getWeakPoints(evalSkills), [evalSkills]);

  const radarData = mySkills.map(s => {
    const base: any = { skill: s.name, score: s.score, fullMark: 10 };
    if (compareEvaluation?.skills) {
      const cs = (compareEvaluation.skills as unknown as Skill[]);
      const match = cs.find(c => c.name === s.name);
      base.compare = match?.score ?? 0;
    }
    return base;
  });

  const barData = [...mySkills].sort((a, b) => a.score - b.score).map(s => {
    const base: any = { skill: s.name, score: s.score };
    if (compareEvaluation?.skills) {
      const cs = (compareEvaluation.skills as unknown as Skill[]);
      const match = cs.find(c => c.name === s.name);
      base.compare = match?.score ?? 0;
    }
    return base;
  });

  const historyData = evalHistory.map(h => {
    const hSkills = h.skills as unknown as Skill[];
    const visible = hSkills.filter(s => !s.hidden);
    const avg = visible.length ? visible.reduce((sum, s) => sum + s.score, 0) / visible.length : 0;
    return {
      month: format(parseLocalDate(h.evaluation_month), 'MMM yy', { locale: es }),
      promedio: parseFloat(avg.toFixed(1)),
    };
  });

  const yearlySkillData = useMemo(() => {
    if (evalHistory.length < 2) return [];
    const skillNames = new Set<string>();
    evalHistory.forEach(h => {
      (h.skills as unknown as Skill[]).forEach(s => { if (!s.hidden) skillNames.add(s.name); });
    });
    return Array.from(skillNames).map(name => {
      const scores = evalHistory.map(h => {
        const s = (h.skills as unknown as Skill[]).find(sk => sk.name === name);
        return s?.score ?? 0;
      });
      const latest = scores[scores.length - 1];
      const first = scores[0];
      return { name, latest, first, change: latest - first };
    }).sort((a, b) => a.change - b.change);
  }, [evalHistory]);

  const getBarColor = (_score: number) => {
    return 'hsl(var(--primary))';
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

  // Punctuality stats from jornada history
  const puntualidadStats = useMemo(() => {
    if (!myJornadaHistory.length) return { total: 0, late: 0, onTime: 0, incidents: 0 };
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
        <TabsList className="w-full flex overflow-x-auto scrollbar-hide gap-1 justify-start bg-muted/50 p-1 rounded-lg">
          <TabsTrigger value="dashboard" className="gap-1 shrink-0 text-xs sm:text-sm">
            <LayoutDashboard className="h-3.5 w-3.5 hidden sm:block" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="cobros" className="gap-1 shrink-0 text-xs sm:text-sm">
            <DollarSign className="h-3.5 w-3.5 hidden sm:block" />
            Cobros
          </TabsTrigger>
          <TabsTrigger value="evaluaciones" className="gap-1 shrink-0 text-xs sm:text-sm">
            <Activity className="h-3.5 w-3.5 hidden sm:block" />
            Evaluaciones
          </TabsTrigger>
          <TabsTrigger value="actividad" className="gap-1 shrink-0 text-xs sm:text-sm">
            <CalendarDays className="h-3.5 w-3.5 hidden sm:block" />
            Actividad
          </TabsTrigger>
          <TabsTrigger value="info" className="gap-1 shrink-0 text-xs sm:text-sm">
            <Info className="h-3.5 w-3.5 hidden sm:block" />
            Info
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB 1: DASHBOARD ===== */}
        <TabsContent value="dashboard">
          {businessId && myJornada?.sucursal_id && (
            <MyEmploymentDashboard
              businessId={businessId}
              branchId={myJornada.sucursal_id}
              jornadaActiva={!!jornadaActiva}
              myJornada={myJornada}
              dailySalary={dailySalary}
              needsCount={needsCount}
              onOpenContarYCerrar={() => needsCount ? setContarYCerrarOpen(true) : setCerrarMiJornadaOpen(true)}
            />
          )}
          {!myJornada?.sucursal_id && businessId && (
            <MyEmploymentDashboard
              businessId={businessId}
              branchId={myEmployeeRecord.branch_id || profile?.branch_id || ''}
              jornadaActiva={false}
              myJornada={myJornada}
              dailySalary={dailySalary}
              needsCount={needsCount}
              onOpenContarYCerrar={() => needsCount ? setContarYCerrarOpen(true) : setCerrarMiJornadaOpen(true)}
            />
          )}
        </TabsContent>


        {/* ===== TAB: COBROS ===== */}
        <TabsContent value="cobros" className="space-y-4">
          {myEmployeeRecord && (
            <EmployeeSalaryView
              employeeBusinessId={myEmployeeRecord.business_id}
              employeeBranchId={myEmployeeRecord.branch_id ?? profile?.branch_id ?? null}
            />
          )}
        </TabsContent>

        {/* ===== TAB: EVALUACIONES ===== */}
        <TabsContent value="evaluaciones" className="space-y-4">
          {/* Month selector */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleMonthChange('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium min-w-[100px] text-center">
                {format(selectedMonth, 'MMMM yyyy', { locale: es })}
              </span>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleMonthChange('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {/* Chart type toggle */}
              <Button
                variant={chartType === 'radar' ? 'default' : 'outline'}
                size="icon" className="h-7 w-7"
                onClick={() => setChartType('radar')}
              >
                <Activity className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={chartType === 'bar' ? 'default' : 'outline'}
                size="icon" className="h-7 w-7"
                onClick={() => setChartType('bar')}
              >
                <BarChart3 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Compare selector */}
          {compareEmployees.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Comparar con:</span>
              <Select value={compareEmployeeId || ''} onValueChange={v => setCompareEmployeeId(v || null)}>
                <SelectTrigger className="h-7 text-xs w-[180px]">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  {compareEmployees.map(e => (
                    <SelectItem key={e.id} value={e.id} className="text-xs">{e.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {compareEmployeeId && (
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setCompareEmployeeId(null)}>
                  Limpiar
                </Button>
              )}
            </div>
          )}

          {evalLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : mySkills.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Activity className="h-10 w-10 opacity-40 mb-3" />
                <p className="text-sm">Sin evaluación este mes</p>
                <p className="text-xs mt-1">Tu evaluación aparecerá cuando sea registrada.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Score and chart */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Puntuación General</CardTitle>
                    <Badge variant="secondary">{myAvg.toFixed(1)}/10</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className={`w-full ${chartType === 'bar' ? '' : 'h-[300px]'}`}
                    style={chartType === 'bar' ? { height: Math.max(300, barData.length * 44) } : undefined}>
                    <ResponsiveContainer width="100%" height="100%">
                      {chartType === 'radar' ? (
                        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="65%">
                          <PolarGrid />
                          <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
                          <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} />
                          <Tooltip contentStyle={{ ...rechartsTooltipStyle.contentStyle, fontSize: 12 }} labelStyle={rechartsTooltipStyle.labelStyle} itemStyle={rechartsTooltipStyle.itemStyle} />
                          <Radar name="Mi evaluación" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                          {compareEvaluation && (
                            <Radar name="Comparación" dataKey="compare" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.15} />
                          )}
                        </RadarChart>
                      ) : (
                        <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 15, top: 5, bottom: 5 }}
                          barCategoryGap="30%">
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 12 }} />
                          <YAxis type="category" dataKey="skill" tick={{ fontSize: 12 }} width={110} />
                          <Tooltip contentStyle={{ ...rechartsTooltipStyle.contentStyle, fontSize: 12 }} labelStyle={rechartsTooltipStyle.labelStyle} itemStyle={rechartsTooltipStyle.itemStyle} />
                          <Bar dataKey="score" name="Mi evaluación" radius={[0, 6, 6, 0]} barSize={16}>
                            {barData.map((entry, idx) => (
                              <Cell key={idx} fill={getBarColor(entry.score)} />
                            ))}
                          </Bar>
                          {compareEvaluation && (
                            <Bar dataKey="compare" name="Comparación" fill="hsl(var(--destructive))" fillOpacity={0.5} radius={[0, 4, 4, 0]} barSize={10} />
                          )}
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Weak points */}
              {myWeak.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Puntos Débiles
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1.5">
                      {myWeak.map(w => (
                        <Badge key={w.name} variant="outline" className="text-xs border-destructive/50 text-destructive">
                          {w.name}: {w.score}/10
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Skill notes */}
              {evalSkills.some(s => s.note && !s.hidden) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Notas del evaluador
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {evalSkills.filter(s => s.note && !s.hidden).map(s => (
                        <div key={s.name} className="rounded-lg border bg-muted/30 p-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold">{s.name}</span>
                            <Badge variant="secondary" className="text-[10px]">{s.score}/10</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">{s.note}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}


              {/* History trend */}
              {historyData.length > 1 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Historial de Desempeño
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="w-full h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={historyData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                          <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
                          <Tooltip contentStyle={{ ...rechartsTooltipStyle.contentStyle, fontSize: 11 }} labelStyle={rechartsTooltipStyle.labelStyle} itemStyle={rechartsTooltipStyle.itemStyle} />
                          <ReferenceLine y={5} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                          <Line type="monotone" dataKey="promedio" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Skill development */}
              {yearlySkillData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Desarrollo por Habilidad</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {yearlySkillData.map(s => (
                        <div key={s.name} className="flex items-center justify-between text-xs">
                          <span className="truncate max-w-[150px]">{s.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">{s.first} → {s.latest}</span>
                            <Badge variant={s.change > 0 ? 'default' : s.change < 0 ? 'destructive' : 'secondary'} className="text-[10px]">
                              {s.change > 0 ? '+' : ''}{s.change.toFixed(1)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

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

        {/* ===== TAB: INFO ===== */}
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

          {/* Salary assignment info */}
          {mySalaryAssignment && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4" />
                  Información de Nómina
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground">Modalidad</p>
                    <p className="text-sm font-medium">{(mySalaryAssignment as any)?.salary_modalities?.name || 'Sin asignar'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">Frecuencia de Pago</p>
                    <Badge variant="outline" className="text-[10px]">
                      {mySalaryAssignment.pay_frequency === 'daily' ? 'Diaria' : mySalaryAssignment.pay_frequency === 'weekly' ? 'Semanal' : mySalaryAssignment.pay_frequency === 'biweekly' ? 'Quincenal' : 'Mensual'}
                    </Badge>
                  </div>
                  {Number(mySalaryAssignment.base_salary) > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground">Salario Base</p>
                      <p className="text-sm font-medium">${Number(mySalaryAssignment.base_salary).toFixed(2)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
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

      {/* Contar y Cerrar Jornada */}
      {myJornada && businessId && (
        <ContarYCerrarModal
          open={contarYCerrarOpen}
          onOpenChange={setContarYCerrarOpen}
          jornada={myJornada}
          employeeBusinessId={businessId}
          dailySalary={dailySalary}
        />
      )}

      {/* Cerrar mi propia jornada (fallback) */}
      {myJornada && (
        <CerrarJornadaModal
          open={cerrarMiJornadaOpen}
          onOpenChange={setCerrarMiJornadaOpen}
          jornada={myJornada}
        />
      )}
    </AppLayout>
  );
};

export default MyEmployment;
