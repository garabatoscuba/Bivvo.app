import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  BarChart3, Activity, Plus, Eye, EyeOff, Save, Loader2, ChevronLeft, ChevronRight, Users,
} from 'lucide-react';
import { format, startOfMonth, subMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';

interface Skill {
  category: string;
  name: string;
  score: number;
  hidden?: boolean;
  custom?: boolean;
}

const DEFAULT_ATTITUDE_SKILLS: Skill[] = [
  { category: 'Actitud', name: 'Puntualidad', score: 5 },
  { category: 'Actitud', name: 'Responsabilidad', score: 5 },
  { category: 'Actitud', name: 'Habilidades sociales', score: 5 },
  { category: 'Actitud', name: 'Trabajo en equipo', score: 5 },
  { category: 'Actitud', name: 'Iniciativa', score: 5 },
  { category: 'Actitud', name: 'Adaptabilidad', score: 5 },
];

const DEFAULT_PERFORMANCE_SKILLS: Skill[] = [
  { category: 'Desempeño', name: 'Productividad', score: 5 },
  { category: 'Desempeño', name: 'Calidad del trabajo', score: 5 },
  { category: 'Desempeño', name: 'Atención al cliente', score: 5 },
  { category: 'Desempeño', name: 'Conocimiento del producto', score: 5 },
  { category: 'Desempeño', name: 'Organización', score: 5 },
  { category: 'Desempeño', name: 'Cumplimiento de metas', score: 5 },
];

const DEFAULT_LEADERSHIP_SKILLS: Skill[] = [
  { category: 'Liderazgo', name: 'Toma de decisiones', score: 5 },
  { category: 'Liderazgo', name: 'Gestión del tiempo', score: 5 },
  { category: 'Liderazgo', name: 'Resolución de conflictos', score: 5 },
];

function getDefaultSkills(position: string): Skill[] {
  const base = [...DEFAULT_ATTITUDE_SKILLS, ...DEFAULT_PERFORMANCE_SKILLS];
  if (position === 'manager') {
    return [...base, ...DEFAULT_LEADERSHIP_SKILLS];
  }
  return base;
}

const CATEGORY_COLORS: Record<string, string> = {
  Actitud: 'hsl(var(--primary))',
  Desempeño: 'hsl(var(--accent-foreground))',
  Liderazgo: 'hsl(var(--destructive))',
  Personalizada: 'hsl(var(--secondary-foreground))',
};

interface PerformanceChartProps {
  employeeId: string;
  employeeName: string;
  position: string;
  businessId: string;
  branchId?: string | null;
  canEdit: boolean;
  onClose: () => void;
}

export default function PerformanceChart({
  employeeId,
  employeeName,
  position,
  businessId,
  branchId,
  canEdit,
  onClose,
}: PerformanceChartProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [chartType, setChartType] = useState<'radar' | 'bar'>('radar');
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [skills, setSkills] = useState<Skill[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [saving, setSaving] = useState(false);
  const [compareEmployeeId, setCompareEmployeeId] = useState<string | null>(null);

  const monthKey = format(selectedMonth, 'yyyy-MM-dd');

  // Fetch evaluation for selected month
  const { data: evaluation, isLoading } = useQuery({
    queryKey: ['evaluation', employeeId, monthKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_evaluations')
        .select('*')
        .eq('employee_id', employeeId)
        .eq('evaluation_month', monthKey)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch all evaluations for history
  const { data: history = [] } = useQuery({
    queryKey: ['evaluation-history', employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employee_evaluations')
        .select('evaluation_month, skills')
        .eq('employee_id', employeeId)
        .order('evaluation_month', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Fetch employees for comparison
  const { data: branchEmployees = [] } = useQuery({
    queryKey: ['branch-employees-compare', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('business_id', businessId)
        .neq('id', employeeId)
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch comparison evaluation
  const { data: compareEvaluation } = useQuery({
    queryKey: ['evaluation', compareEmployeeId, monthKey],
    queryFn: async () => {
      if (!compareEmployeeId) return null;
      const { data, error } = await supabase
        .from('employee_evaluations')
        .select('*')
        .eq('employee_id', compareEmployeeId)
        .eq('evaluation_month', monthKey)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!compareEmployeeId,
  });

  // Initialize skills from evaluation or defaults
  if (!initialized && !isLoading) {
    if (evaluation?.skills) {
      setSkills(evaluation.skills as unknown as Skill[]);
    } else {
      setSkills(getDefaultSkills(position));
    }
    setInitialized(true);
  }

  // Reset when month changes
  const handleMonthChange = (direction: 'prev' | 'next') => {
    setInitialized(false);
    setSelectedMonth(prev => direction === 'prev' ? subMonths(prev, 1) : addMonths(prev, 1));
  };

  const updateSkillScore = (index: number, score: number) => {
    setSkills(prev => prev.map((s, i) => i === index ? { ...s, score } : s));
  };

  const toggleSkillVisibility = (index: number) => {
    setSkills(prev => prev.map((s, i) => i === index ? { ...s, hidden: !s.hidden } : s));
  };

  const addCustomSkill = () => {
    if (!newSkillName.trim()) return;
    setSkills(prev => [...prev, { category: 'Personalizada', name: newSkillName.trim(), score: 5, custom: true }]);
    setNewSkillName('');
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        employee_id: employeeId,
        business_id: businessId,
        evaluated_by: user.id,
        evaluation_month: monthKey,
        skills: skills as any,
      };

      if (evaluation) {
        const { error } = await supabase
          .from('employee_evaluations')
          .update({ skills: skills as any, evaluated_by: user.id })
          .eq('id', evaluation.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('employee_evaluations')
          .insert(payload);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['evaluation', employeeId, monthKey] });
      queryClient.invalidateQueries({ queryKey: ['evaluation-history', employeeId] });
      toast.success('Evaluación guardada');
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const visibleSkills = skills.filter(s => !s.hidden);
  const avgScore = visibleSkills.length
    ? (visibleSkills.reduce((sum, s) => sum + s.score, 0) / visibleSkills.length).toFixed(1)
    : '0';

  // Radar data
  const radarData = visibleSkills.map(s => {
    const base: any = { skill: s.name, score: s.score, fullMark: 10 };
    if (compareEvaluation?.skills) {
      const compareSkills = compareEvaluation.skills as unknown as Skill[];
      const match = compareSkills.find(cs => cs.name === s.name);
      base.compare = match?.score ?? 0;
    }
    return base;
  });

  // Bar data
  const barData = visibleSkills.map(s => {
    const base: any = { skill: s.name, score: s.score };
    if (compareEvaluation?.skills) {
      const compareSkills = compareEvaluation.skills as unknown as Skill[];
      const match = compareSkills.find(cs => cs.name === s.name);
      base.compare = match?.score ?? 0;
    }
    return base;
  });

  // History chart data
  const historyData = history.map(h => {
    const hSkills = h.skills as unknown as Skill[];
    const visible = hSkills.filter(s => !s.hidden);
    const avg = visible.length ? visible.reduce((sum, s) => sum + s.score, 0) / visible.length : 0;
    return {
      month: format(new Date(h.evaluation_month), 'MMM yy', { locale: es }),
      promedio: parseFloat(avg.toFixed(1)),
    };
  });

  const categories = [...new Set(skills.map(s => s.category))];

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Evaluación de {employeeName}
          </DialogTitle>
          <DialogDescription>
            Puntuaciones de habilidades y desempeño
          </DialogDescription>
        </DialogHeader>

        {/* Month selector */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => handleMonthChange('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium capitalize">
            {format(selectedMonth, 'MMMM yyyy', { locale: es })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleMonthChange('next')}
            disabled={selectedMonth >= startOfMonth(new Date())}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="chart" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="chart">Gráfica</TabsTrigger>
              <TabsTrigger value="skills">Habilidades</TabsTrigger>
              <TabsTrigger value="history">Historial</TabsTrigger>
            </TabsList>

            {/* Chart tab */}
            <TabsContent value="chart" className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant={chartType === 'radar' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setChartType('radar')}
                  >
                    <Activity className="h-4 w-4 mr-1" /> Radar
                  </Button>
                  <Button
                    variant={chartType === 'bar' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setChartType('bar')}
                  >
                    <BarChart3 className="h-4 w-4 mr-1" /> Barras
                  </Button>
                </div>
                <Badge variant="secondary" className="text-sm">
                  Promedio: {avgScore}/10
                </Badge>
              </div>

              {/* Comparison selector */}
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={compareEmployeeId || 'none'}
                  onValueChange={(v) => setCompareEmployeeId(v === 'none' ? null : v)}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Comparar con..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin comparación</SelectItem>
                    {branchEmployees.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-full h-[300px] sm:h-[400px]">
                {chartType === 'radar' ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                      <PolarGrid />
                      <PolarAngleAxis dataKey="skill" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fontSize: 9 }} />
                      <Radar
                        name={employeeName}
                        dataKey="score"
                        stroke="hsl(var(--primary))"
                        fill="hsl(var(--primary))"
                        fillOpacity={0.3}
                      />
                      {compareEmployeeId && (
                        <Radar
                          name="Comparación"
                          dataKey="compare"
                          stroke="hsl(var(--destructive))"
                          fill="hsl(var(--destructive))"
                          fillOpacity={0.15}
                        />
                      )}
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" domain={[0, 10]} />
                      <YAxis type="category" dataKey="skill" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        dataKey="score"
                        name={employeeName}
                        fill="hsl(var(--primary))"
                        radius={[0, 4, 4, 0]}
                      />
                      {compareEmployeeId && (
                        <Bar
                          dataKey="compare"
                          name="Comparación"
                          fill="hsl(var(--destructive))"
                          radius={[0, 4, 4, 0]}
                        />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </TabsContent>

            {/* Skills editing tab */}
            <TabsContent value="skills" className="space-y-4">
              {categories.map(cat => (
                <div key={cat} className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[cat] || CATEGORY_COLORS.Personalizada }}
                    />
                    {cat}
                  </h4>
                  <div className="space-y-3">
                    {skills.map((skill, idx) => {
                      if (skill.category !== cat) return null;
                      return (
                        <div
                          key={`${skill.name}-${idx}`}
                          className={`flex items-center gap-3 p-2 rounded-lg border ${skill.hidden ? 'opacity-40' : ''}`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium truncate">{skill.name}</span>
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-bold w-6 text-center">{skill.score}</span>
                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => toggleSkillVisibility(idx)}
                                  >
                                    {skill.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                  </Button>
                                )}
                              </div>
                            </div>
                            {canEdit && !skill.hidden && (
                              <Slider
                                value={[skill.score]}
                                onValueChange={([v]) => updateSkillScore(idx, v)}
                                min={1}
                                max={10}
                                step={1}
                                className="mt-1"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Add custom skill */}
              {canEdit && (
                <div className="flex items-end gap-2 pt-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Habilidad personalizada</Label>
                    <Input
                      placeholder="Nombre de la habilidad"
                      value={newSkillName}
                      onChange={e => setNewSkillName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addCustomSkill()}
                    />
                  </div>
                  <Button size="sm" onClick={addCustomSkill} disabled={!newSkillName.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {canEdit && (
                <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Guardar evaluación
                </Button>
              )}
            </TabsContent>

            {/* History tab */}
            <TabsContent value="history" className="space-y-4">
              {historyData.length > 1 ? (
                <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 10]} />
                      <Tooltip />
                      <Line
                        type="monotone"
                        dataKey="promedio"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        name="Promedio"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Activity className="mx-auto h-12 w-12 opacity-50 mb-2" />
                  <p>Se necesitan al menos 2 meses de evaluaciones para mostrar el historial.</p>
                </div>
              )}

              {history.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold">Meses evaluados</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {history.map(h => (
                      <Badge
                        key={h.evaluation_month}
                        variant={h.evaluation_month === monthKey ? 'default' : 'outline'}
                        className="cursor-pointer capitalize"
                        onClick={() => {
                          setInitialized(false);
                          setSelectedMonth(new Date(h.evaluation_month));
                        }}
                      >
                        {format(new Date(h.evaluation_month), 'MMM yy', { locale: es })}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
