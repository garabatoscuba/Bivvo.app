import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Activity, AlertTriangle } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

/** Format a Date to 'YYYY-MM-DD' using local components */
function formatLocalMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}
import { type Skill, getWeakPoints, getAvgScore } from '@/components/employees/PerformanceChart';

export default function PerformanceWidget() {
  const { profile } = useAuth();
  const businessId = profile?.business_id;
  const monthKey = formatLocalMonthKey(new Date());

  // Fetch employees
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-widget', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('business_id', businessId)
        .order('full_name')
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const activeId = selectedEmployeeId || employees[0]?.id || null;

  // Fetch current month evaluation
  const { data: evaluation, isLoading } = useQuery({
    queryKey: ['evaluation-widget', activeId, monthKey],
    queryFn: async () => {
      if (!activeId) return null;
      const { data, error } = await supabase
        .from('employee_evaluations')
        .select('skills')
        .eq('employee_id', activeId)
        .eq('evaluation_month', monthKey)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!activeId,
  });

  const skills = useMemo(() => {
    if (!evaluation?.skills) return [];
    return (evaluation.skills as unknown as Skill[]).filter(s => !s.hidden);
  }, [evaluation]);

  const avg = useMemo(() => getAvgScore(skills), [skills]);
  const weak = useMemo(() => getWeakPoints(skills), [skills]);

  const radarData = skills.map(s => ({ skill: s.name, score: s.score, fullMark: 10 }));
  const activeName = employees.find(e => e.id === activeId)?.full_name || '';

  if (!businessId || employees.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Desempeño
          </CardTitle>
          <Select value={activeId || ''} onValueChange={v => setSelectedEmployeeId(v)}>
            <SelectTrigger className="w-[140px] sm:w-[180px] h-8 text-xs">
              <SelectValue placeholder="Empleado" />
            </SelectTrigger>
            <SelectContent>
              {employees.map(e => (
                <SelectItem key={e.id} value={e.id} className="text-xs">{e.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-[200px] w-full" />
        ) : skills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-center text-muted-foreground">
            <Activity className="h-8 w-8 opacity-40 mb-2" />
            <p className="text-xs">Sin evaluación este mes</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground capitalize">
                {format(startOfMonth(new Date()), 'MMMM yyyy', { locale: es })}
              </span>
              <Badge variant="secondary" className="text-xs">
                {avg.toFixed(1)}/10
              </Badge>
            </div>

            <div className="w-full h-[180px] sm:h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="65%">
                  <PolarGrid />
                  <PolarAngleAxis dataKey="skill" tick={{ fontSize: 9 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} />
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                  <Radar name={activeName} dataKey="score"
                    stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                </RadarChart>
              </ResponsiveContainer>
            </div>

            {/* Weak points */}
            {weak.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 text-warning" />
                  Puntos débiles
                </p>
                <div className="flex flex-wrap gap-1">
                  {weak.map(w => (
                    <Badge key={w.name} variant="outline"
                      className="text-[10px] border-destructive/50 text-destructive">
                      {w.name}: {w.score}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
