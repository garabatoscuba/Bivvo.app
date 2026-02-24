import { useState, useMemo, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DollarSign, ShoppingCart, Receipt, Wrench, FileText, LogOut,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import CerrarJornadaModal from '@/components/employees/CerrarJornadaModal';
import ContarYCerrarModal from '@/components/employees/ContarYCerrarModal';
import { toast as sonnerToast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import EquipoActivoSection from '@/components/employees/EquipoActivoSection';
import CerrarJornadaGerenteModal from '@/components/employees/CerrarJornadaGerenteModal';
import { useJornadaActiva } from '@/hooks/useJornadaActiva';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Legend, LineChart, Line, ReferenceLine, Cell,
} from 'recharts';
import { type Skill, getWeakPoints, getAvgScore } from '@/components/employees/PerformanceChart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, startOfMonth, subMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import PayrollHistory from '@/components/nomina/PayrollHistory';

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
}

const MyEmployment = () => {
  const { profile, user, isOwner, isManager, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: branches = [] } = useBranches();
  const { jornadaActiva, jornada: myJornada, isLoading: jornadaLoading2 } = useJornadaActiva();
  const canManage = false;

  const [jornadaCerrarTarget, setJornadaCerrarTarget] = useState<{ jornada: any; name: string } | null>(null);
  const [jornadaLoading, setJornadaLoading] = useState<string | null>(null);
  const [cerrarMiJornadaOpen, setCerrarMiJornadaOpen] = useState(false);
  const [contarYCerrarOpen, setContarYCerrarOpen] = useState(false);

  // Daily copies state for copy shop employees
  const [copiesCash, setCopiesCash] = useState('');
  const [copiesTransfer, setCopiesTransfer] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [chartType, setChartType] = useState<'radar' | 'bar'>('radar');
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

  // CRITICAL: Use the EMPLOYER's business_id, NOT the user's own business
  const businessId = myEmployeeRecord?.business_id || null;
  const monthKey = formatLocalMonthKey(selectedMonth);

  // Fetch employer business type for conditional tools
  const { data: employerBiz } = useQuery({
    queryKey: ['employer-biz-type', businessId],
    queryFn: async () => {
      const { data } = await supabase.from('businesses').select('business_type').eq('id', businessId!).single();
      return data;
    },
    enabled: !!businessId,
  });
  const isEmployerCopyShop = employerBiz?.business_type === 'copy_shop';
  const hasAuthorizedJornada = jornadaActiva && myJornada?.metodo_apertura === 'manual_gerente';

  // Fetch today's copies for this employee (copy shop)
  const todayStr = new Date().toISOString().split('T')[0];
  const { data: todayCopiesRecord } = useQuery({
    queryKey: ['my-daily-copies', businessId, todayStr, profile?.user_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_copies')
        .select('*')
        .eq('user_id', profile!.user_id)
        .eq('business_id', businessId!)
        .eq('date', todayStr)
        .maybeSingle();
      return data;
    },
    enabled: !!businessId && !!profile?.user_id && isEmployerCopyShop && jornadaActiva,
  });

  // Fetch today's service earnings for salary preview
  const { data: todayServiceEarnings = 0 } = useQuery({
    queryKey: ['my-today-service-earnings', businessId, myJornada?.sucursal_id, todayStr],
    queryFn: async () => {
      const startOfDay = todayStr + 'T00:00:00';
      const endOfDay = todayStr + 'T23:59:59';
      const { data } = await supabase
        .from('service_entries')
        .select('amount')
        .eq('business_id', businessId!)
        .eq('branch_id', myJornada!.sucursal_id)
        .eq('user_id', profile!.user_id)
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);
      return data?.reduce((sum, s) => sum + Number(s.amount), 0) || 0;
    },
    enabled: !!businessId && !!myJornada?.sucursal_id && !!profile?.user_id && !!jornadaActiva,
    refetchInterval: 30000,
  });

  // Fetch today's sales commissions for salary preview
  const { data: todaySalesTotal = 0 } = useQuery({
    queryKey: ['my-today-sales-total', myJornada?.sucursal_id, todayStr],
    queryFn: async () => {
      const startOfDay = todayStr + 'T00:00:00';
      const endOfDay = todayStr + 'T23:59:59';
      const { data } = await supabase
        .from('sales')
        .select('total')
        .eq('branch_id', myJornada!.sucursal_id)
        .eq('user_id', profile!.user_id)
        .eq('status', 'completed')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);
      return data?.reduce((sum, s) => sum + Number(s.total), 0) || 0;
    },
    enabled: !!myJornada?.sucursal_id && !!profile?.user_id && !!jornadaActiva,
    refetchInterval: 30000,
  });

  // Fetch today's sale items for product commission calculation
  const { data: todaySaleItems = [] } = useQuery({
    queryKey: ['my-today-sale-items', myJornada?.sucursal_id, todayStr],
    queryFn: async () => {
      const startOfDay = todayStr + 'T00:00:00';
      const endOfDay = todayStr + 'T23:59:59';
      // Get today's completed sale IDs first
      const { data: sales } = await supabase
        .from('sales')
        .select('id')
        .eq('branch_id', myJornada!.sucursal_id)
        .eq('user_id', profile!.user_id)
        .eq('status', 'completed')
        .gte('created_at', startOfDay)
        .lte('created_at', endOfDay);
      if (!sales?.length) return [];
      const saleIds = sales.map(s => s.id);
      const { data: items } = await supabase
        .from('sale_items')
        .select('product_id, quantity, unit_price, cost_price, total')
        .in('sale_id', saleIds);
      return items || [];
    },
    enabled: !!myJornada?.sucursal_id && !!profile?.user_id && !!jornadaActiva,
    refetchInterval: 30000,
  });

  // Fetch product commissions config
  const { data: productCommissions = [] } = useQuery({
    queryKey: ['my-product-commissions', businessId],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_commissions')
        .select('product_id, commission_type, commission_value, split_type')
        .eq('business_id', businessId!);
      return data || [];
    },
    enabled: !!businessId && !!jornadaActiva,
  });

  // Fetch active workers count in my branch today
  const { data: activeWorkersCount = 1 } = useQuery({
    queryKey: ['active-workers-count', myJornada?.sucursal_id, todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('jornadas')
        .select('id')
        .eq('sucursal_id', myJornada!.sucursal_id)
        .is('cierre_at', null);
      return Math.max(1, data?.length || 1);
    },
    enabled: !!myJornada?.sucursal_id && !!jornadaActiva,
    refetchInterval: 30000,
  });

  // Fetch salary assignments (multiple) for display
  const { data: mySalaryAssignments = [] } = useQuery({
    queryKey: ['my-salary-assignments', myEmployeeRecord?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('employee_salary_assignments')
        .select('*, salary_modalities(name, modality_type, config, presets)')
        .eq('employee_id', myEmployeeRecord!.id)
        .eq('is_active', true);
      return data || [];
    },
    enabled: !!myEmployeeRecord?.id,
  });

  // Keep backward compat alias
  const mySalaryAssignment = mySalaryAssignments[0] || null;

  // Total copies for today (treated as services)
  const todayCopiesTotalAmount = (parseFloat(copiesCash) || 0) + (parseFloat(copiesTransfer) || 0);

  // Calculate running daily salary from ALL assignments
  const dailySalary = useMemo(() => {
    if (!mySalaryAssignments.length) return null;
    let totalBase = 0;
    let totalServiceEarning = 0;
    let totalSalesEarning = 0;
    let totalCommissionEarning = 0;

    // Service base = service entries + copies
    const serviceBase = todayServiceEarnings + (isEmployerCopyShop ? todayCopiesTotalAmount : 0);

    for (const assignment of mySalaryAssignments) {
      const modType = (assignment as any)?.salary_modalities?.modality_type;
      const config = (assignment as any)?.salary_modalities?.config || {};
      const baseSalary = Number(assignment.base_salary || 0);
      const configOverride = assignment.config_override as Record<string, any> || {};

      switch (modType) {
        case 'fixed': {
          const freq = assignment.pay_frequency;
          const days = freq === 'daily' ? 1 : freq === 'weekly' ? 7 : freq === 'biweekly' ? 15 : 30;
          totalBase += baseSalary / days;
          break;
        }
        case 'custom_mixed': {
          // Find the condition matching active workers count
          const conditions = config.conditions || [];
          // Exact match first, then closest <= activeWorkersCount
          const matchedCondition = conditions.find((c: any) => c.positions === activeWorkersCount)
            || conditions
              .filter((c: any) => c.positions <= activeWorkersCount)
              .sort((a: any, b: any) => b.positions - a.positions)[0]
            || conditions.sort((a: any, b: any) => a.positions - b.positions)[0];
          
          // Check if employee has a preset override
          const presetId = configOverride?.preset_id;
          let servicePercent = matchedCondition?.service_percent || 0;
          
          if (presetId) {
            const presets = (assignment as any)?.salary_modalities?.presets || [];
            const preset = presets.find((p: any) => p.id === presetId);
            if (preset?.config?.service_percent_override != null) {
              servicePercent = preset.config.service_percent_override;
            }
          }

          // For copy shops, services + copies all go through same percent
          // serviceBase already includes copies
          // Apply to the full service+copies pool by default
          const appliesTo = configOverride?.applies_to || config.applies_to || 'both';

          if (appliesTo === 'services' || appliesTo === 'both') {
            totalServiceEarning += serviceBase * (servicePercent / 100);
          }
          if (appliesTo === 'products' || appliesTo === 'both') {
            totalSalesEarning += todaySalesTotal * (servicePercent / 100);
          }
          break;
        }
        case 'fixed_plus_sales_percent': {
          const freq = assignment.pay_frequency;
          const days = freq === 'daily' ? 1 : freq === 'weekly' ? 7 : freq === 'biweekly' ? 15 : 30;
          totalBase += baseSalary / days;
          const salesPct = Number(config.sales_percent || 0);
          if (salesPct > 0) totalSalesEarning += todaySalesTotal * (salesPct / 100);
          break;
        }
        case 'sales_percent_only': {
          const salesPct = Number(config.sales_percent || config.percent || 0);
          if (salesPct > 0) totalSalesEarning += todaySalesTotal * (salesPct / 100);
          break;
        }
        case 'profit_percent': {
          // Calculate profit from today's sale items
          const totalProfit = todaySaleItems.reduce((sum, item) => {
            return sum + (Number(item.unit_price) - Number(item.cost_price)) * Number(item.quantity);
          }, 0);
          const profitPct = Number(config.profit_percent || config.percent || 0);
          if (profitPct > 0) totalSalesEarning += totalProfit * (profitPct / 100);
          break;
        }
        case 'hourly': {
          // Calculate hours from jornada start
          if (myJornada) {
            const hoursWorked = (Date.now() - new Date(myJornada.apertura_at).getTime()) / 3600000;
            const hourlyRate = Number(config.hourly_rate || baseSalary || 0);
            totalBase += hourlyRate * hoursWorked;
          }
          break;
        }
        default: {
          // Fallback for any other type
          totalBase += baseSalary;
          const servicePercent = Number(config.service_percent || config.percent || 0);
          if (servicePercent > 0) totalServiceEarning += serviceBase * (servicePercent / 100);
          const salesPercent = Number(config.sales_percent || 0);
          if (salesPercent > 0) totalSalesEarning += todaySalesTotal * (salesPercent / 100);
        }
      }
    }

    // Product commissions from product_commissions table
    for (const item of todaySaleItems) {
      const commConfig = productCommissions.find((c: any) => c.product_id === item.product_id);
      if (!commConfig || Number(commConfig.commission_value) === 0) continue;

      let commAmount = 0;
      if (commConfig.commission_type === 'fixed') {
        commAmount = Number(commConfig.commission_value) * Number(item.quantity);
      } else if (commConfig.commission_type === 'percent') {
        commAmount = Number(item.total) * (Number(commConfig.commission_value) / 100);
      } else if (commConfig.commission_type === 'profit_percent') {
        const itemProfit = (Number(item.unit_price) - Number(item.cost_price)) * Number(item.quantity);
        commAmount = itemProfit * (Number(commConfig.commission_value) / 100);
      }

      // Apply split logic
      if (commConfig.split_type === 'shared' && activeWorkersCount > 1) {
        commAmount = commAmount / activeWorkersCount;
      }

      totalCommissionEarning += commAmount;
    }

    const total = totalBase + totalServiceEarning + totalSalesEarning + totalCommissionEarning;
    return {
      total,
      serviceEarning: totalServiceEarning,
      salesEarning: totalSalesEarning,
      commissionEarning: totalCommissionEarning,
      base: totalBase,
    };
  }, [mySalaryAssignments, todayServiceEarnings, todaySalesTotal, todayCopiesTotalAmount, isEmployerCopyShop, activeWorkersCount, todaySaleItems, productCommissions, myJornada]);

  // Save copies
  const handleSaveCopies = async () => {
    if (!businessId || !myJornada || !profile) return;
    const cashVal = parseFloat(copiesCash) || 0;
    const transferVal = parseFloat(copiesTransfer) || 0;

    if (todayCopiesRecord) {
      await supabase.from('daily_copies').update({
        cash_amount: cashVal,
        transfer_amount: transferVal,
      }).eq('id', todayCopiesRecord.id);
    } else {
      await supabase.from('daily_copies').insert({
        user_id: profile.user_id,
        business_id: businessId,
        branch_id: myJornada.sucursal_id,
        cash_amount: cashVal,
        transfer_amount: transferVal,
      });
    }
    queryClient.invalidateQueries({ queryKey: ['my-daily-copies'] });
  };

  // Sync copies inputs from DB
  useEffect(() => {
    if (todayCopiesRecord) {
      setCopiesCash(String(todayCopiesRecord.cash_amount || ''));
      setCopiesTransfer(String(todayCopiesRecord.transfer_amount || ''));
    }
  }, [todayCopiesRecord]);

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

  const mySkills = useMemo(() => {
    return evalSkills.filter(s => !s.hidden);
  }, [evalSkills]);

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

  const getBarColor = (score: number) => {
    if (score <= 4) return 'hsl(var(--destructive))';
    if (score <= 6) return 'hsl(var(--warning, 40 96% 50%))';
    return 'hsl(var(--primary))';
  };

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
            Actividad
          </TabsTrigger>
          <TabsTrigger value="info" className="gap-1">
            <Info className="h-3.5 w-3.5 hidden sm:block" />
            Info
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB 1: DASHBOARD LABORAL ===== */}
        <TabsContent value="dashboard" className="space-y-4">
          {/* Equipo activo with personal jornada info */}
          {businessId && (
            <EquipoActivoSection
              onlyActive
              businessIdOverride={businessId}
              myJornada={myJornada}
              jornadaActiva={jornadaActiva}
            />
          )}

          {/* Daily salary preview */}
          {jornadaActiva && dailySalary && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Salario acumulado hoy</p>
                    <p className="text-2xl font-bold text-primary">${dailySalary.total.toFixed(2)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-primary/30" />
                </div>
                <div className="flex flex-wrap gap-3 mt-1 text-[10px] text-muted-foreground">
                  {dailySalary.base > 0 && <span>Base: ${dailySalary.base.toFixed(2)}</span>}
                  {dailySalary.serviceEarning > 0 && <span>Serv: ${dailySalary.serviceEarning.toFixed(2)}</span>}
                  {dailySalary.salesEarning > 0 && <span>Ventas: ${dailySalary.salesEarning.toFixed(2)}</span>}
                  {dailySalary.commissionEarning > 0 && <span>Comisiones: ${dailySalary.commissionEarning.toFixed(2)}</span>}
                </div>
                {activeWorkersCount > 1 && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    👥 {activeWorkersCount} trabajadores activos
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Copy shop: daily copies inputs */}
          {jornadaActiva && isEmployerCopyShop && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Copias del Día
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Efectivo</label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      value={copiesCash}
                      onChange={e => setCopiesCash(e.target.value)}
                      onBlur={handleSaveCopies}
                      className="h-9"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Transferencia</label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      value={copiesTransfer}
                      onChange={e => setCopiesTransfer(e.target.value)}
                      onBlur={handleSaveCopies}
                      className="h-9"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Total copias: ${((parseFloat(copiesCash) || 0) + (parseFloat(copiesTransfer) || 0)).toFixed(2)}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Quick actions when shift active */}
          {jornadaActiva && (
            <div>
              <Button variant="destructive" className="w-full h-auto py-3 flex flex-col items-center gap-1.5" onClick={() => setContarYCerrarOpen(true)}>
                <LogOut className="h-5 w-5" />
                <span className="text-xs">Contar y Cerrar Jornada</span>
              </Button>
            </div>
          )}

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

          {/* Full Performance Evaluation */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Mi Evaluación
                </CardTitle>
                <Badge variant="secondary" className="text-xs">{myAvg.toFixed(1)}/10</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {/* Month selector */}
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMonthChange('prev')}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-medium capitalize text-xs sm:text-sm">
                  {format(selectedMonth, 'MMMM yyyy', { locale: es })}
                </span>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMonthChange('next')}
                  disabled={selectedMonth >= startOfMonth(new Date())}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {evalLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : mySkills.length > 0 ? (
              <Tabs defaultValue="chart" className="w-full">
                  <TabsList className="w-full flex overflow-x-auto scrollbar-none gap-1 p-1">
                    <TabsTrigger value="chart" className="text-xs flex-shrink-0">Gráfica</TabsTrigger>
                    <TabsTrigger value="skills" className="text-xs flex-shrink-0">Evaluaciones</TabsTrigger>
                    <TabsTrigger value="history" className="text-xs flex-shrink-0">Historial</TabsTrigger>
                    <TabsTrigger value="development" className="text-xs flex-shrink-0">Desarrollo</TabsTrigger>
                  </TabsList>

                  {/* Chart tab */}
                  <TabsContent value="chart" className="space-y-3 mt-3">
                    <div className="flex items-center flex-wrap gap-1.5">
                      <Button variant={chartType === 'radar' ? 'default' : 'outline'} size="sm" className="h-7 text-xs"
                        onClick={() => setChartType('radar')}>
                        <Activity className="h-3.5 w-3.5 mr-1" /> Radar
                      </Button>
                      <Button variant={chartType === 'bar' ? 'default' : 'outline'} size="sm" className="h-7 text-xs"
                        onClick={() => setChartType('bar')}>
                        <BarChart3 className="h-3.5 w-3.5 mr-1" /> Barras
                      </Button>
                      <Select value={compareEmployeeId || 'none'}
                        onValueChange={(v) => setCompareEmployeeId(v === 'none' ? null : v)}>
                        <SelectTrigger className="w-[150px] text-xs h-7">
                          <Users className="h-3 w-3 mr-1 flex-shrink-0" />
                          <SelectValue placeholder="Comparación" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin comparación</SelectItem>
                          {compareEmployees.map(e => (
                            <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Badge variant="secondary" className="text-[10px] ml-auto">Promedio: {myAvg.toFixed(1)}/10</Badge>
                    </div>

                    <div className="w-full h-[300px] sm:h-[360px]">
                      {chartType === 'radar' ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="45%">
                            <PolarGrid />
                            <PolarAngleAxis dataKey="skill" tick={({ x, y, cx, cy, payload, ...rest }) => {
                              const words = (payload.value as string).split(' ');
                              // Push labels outward from center
                              const dx = x - cx;
                              const dy = y - cy;
                              const len = Math.sqrt(dx * dx + dy * dy) || 1;
                              const offsetX = x + (dx / len) * 14;
                              const offsetY = y + (dy / len) * 14;
                              const anchor = Math.abs(dx) < 5 ? 'middle' : dx > 0 ? 'start' : 'end';
                              return (
                                <text x={offsetX} y={offsetY} textAnchor={anchor} className="fill-muted-foreground" style={{ fontSize: 10 }}>
                                  {words.map((w, i) => (
                                    <tspan key={i} x={offsetX} dy={i === 0 ? 0 : 12}>{w}</tspan>
                                  ))}
                                </text>
                              );
                            }} />
                            <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} />
                            <Radar name={myEmployeeRecord.full_name} dataKey="score"
                              stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                            {compareEmployeeId && (
                              <Radar name="Comparación" dataKey="compare"
                                stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.15} />
                            )}
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ fontSize: 11 }} />
                          </RadarChart>
                        </ResponsiveContainer>
                      ) : (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={barData} layout="vertical" margin={{ left: 5, right: 10 }}
                            barCategoryGap="35%">
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                            <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11 }} />
                            <YAxis type="category" dataKey="skill" tick={{ fontSize: 11 }} width={110} />
                            <Tooltip contentStyle={{ fontSize: 11 }} />
                            <Legend wrapperStyle={{ fontSize: 11 }} />
                            <Bar dataKey="score" name={myEmployeeRecord.full_name} radius={[0, 4, 4, 0]} barSize={12}>
                              {barData.map((entry, i) => (
                                <Cell key={i} fill={getBarColor(entry.score)} />
                              ))}
                            </Bar>
                            {compareEmployeeId && (
                              <Bar dataKey="compare" name="Comparación"
                                fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} barSize={8} />
                            )}
                          </BarChart>
                        </ResponsiveContainer>
                      )}
                    </div>

                    {/* Weak points */}
                    {myWeak.length > 0 && (
                      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                          Puntos más débiles
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {myWeak.map(wp => (
                            <Badge key={wp.name} variant="outline" className="text-[10px] border-destructive/50 text-destructive">
                              {wp.name}: {wp.score}/10
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* Skills tab (read-only for employee) */}
                  <TabsContent value="skills" className="space-y-3 mt-3">
                    {(() => {
                      const categories = [...new Set(evalSkills.map(s => s.category))];
                      return categories.map(cat => (
                        <div key={cat} className="space-y-1.5">
                          <h4 className="font-semibold text-xs flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                            {cat}
                          </h4>
                          <div className="space-y-1">
                            {evalSkills.filter(s => s.category === cat && !s.hidden).map((skill, idx) => (
                              <div key={`${skill.name}-${idx}`} className="flex items-center justify-between p-2 rounded-lg border">
                                <span className="text-xs font-medium">{skill.name}</span>
                                <Badge variant={skill.score <= 4 ? 'destructive' : skill.score <= 6 ? 'secondary' : 'default'} className="text-[10px]">
                                  {skill.score}/10
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      ));
                    })()}
                  </TabsContent>

                  {/* History tab */}
                  <TabsContent value="history" className="space-y-3 mt-3">
                    {historyData.length > 1 ? (
                      <div className="w-full h-[220px] sm:h-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={historyData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                            <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} />
                            <Tooltip contentStyle={{ fontSize: 11 }} />
                            <ReferenceLine y={5} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: 'Base', fontSize: 10 }} />
                            <Line type="monotone" dataKey="promedio" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Promedio" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="py-6 text-center text-muted-foreground">
                        <Activity className="mx-auto h-10 w-10 opacity-50 mb-2" />
                        <p className="text-xs">Se necesitan al menos 2 meses para mostrar el historial.</p>
                      </div>
                    )}
                    {evalHistory.length > 0 && (
                      <div className="space-y-1">
                        <h4 className="text-xs font-semibold">Meses evaluados</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {evalHistory.map(h => (
                            <Badge key={h.evaluation_month}
                              variant={h.evaluation_month === monthKey ? 'default' : 'outline'}
                              className="cursor-pointer capitalize text-[10px]"
                              onClick={() => { setSelectedMonth(parseLocalDate(h.evaluation_month)); }}>
                              {format(parseLocalDate(h.evaluation_month), 'MMM yy', { locale: es })}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* Development tab */}
                  <TabsContent value="development" className="space-y-3 mt-3">
                    {yearlySkillData.length > 0 ? (
                      <>
                        <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                          <h4 className="text-xs font-semibold flex items-center gap-1.5">
                            <TrendingUp className="h-3.5 w-3.5 text-primary" />
                            Desarrollo por habilidad
                          </h4>
                          <p className="text-[10px] text-muted-foreground">Cambio desde la primera evaluación hasta la más reciente</p>
                        </div>
                        <div className="w-full h-[280px] sm:h-[340px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={yearlySkillData} layout="vertical" margin={{ left: 5, right: 20 }}
                              barCategoryGap="20%">
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                              <XAxis type="number" tick={{ fontSize: 11 }} />
                              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                              <Tooltip contentStyle={{ fontSize: 11 }} formatter={(v: number) => [`${v > 0 ? '+' : ''}${v}`, 'Cambio']} />
                              <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" />
                              <Bar dataKey="change" radius={[0, 4, 4, 0]} barSize={12}>
                                {yearlySkillData.map((entry, i) => (
                                  <Cell key={i} fill={entry.change >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        {/* Areas needing attention */}
                        <div className="space-y-1.5">
                          <h4 className="text-xs font-semibold flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                            Áreas que necesitan atención
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                            {yearlySkillData.filter(s => s.change < 0 || s.latest <= 4).slice(0, 4).map(s => (
                              <div key={s.name} className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-2">
                                <span className="text-xs font-medium">{s.name}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-muted-foreground">{s.first}→{s.latest}</span>
                                  <Badge variant={s.change >= 0 ? 'secondary' : 'destructive'} className="text-[10px]">
                                    {s.change > 0 ? '+' : ''}{s.change}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                            {yearlySkillData.filter(s => s.change < 0 || s.latest <= 4).length === 0 && (
                              <p className="text-[10px] text-muted-foreground col-span-2">¡Excelente! No hay áreas críticas.</p>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="py-6 text-center text-muted-foreground">
                        <TrendingUp className="mx-auto h-10 w-10 opacity-50 mb-2" />
                        <p className="text-xs">Se necesitan al menos 2 evaluaciones para mostrar el desarrollo.</p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="py-6 text-center text-muted-foreground">
                  <Activity className="mx-auto h-10 w-10 opacity-50 mb-2" />
                  <p className="text-xs">No hay evaluación para este mes.</p>
                </div>
              )}
            </CardContent>
          </Card>

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


        {/* ===== TAB 4: INFORMACIÓN LABORAL + Nómina info ===== */}
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
