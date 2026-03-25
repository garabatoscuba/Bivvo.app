import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, ReferenceLine, Cell,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  BarChart3, Activity, Plus, Eye, EyeOff, Save, Loader2, ChevronLeft, ChevronRight, Users,
  AlertTriangle, TrendingUp, Globe, Lock, Pencil, Trash2, ArrowUp, ArrowDown, ArrowRightLeft,
  MessageSquare, Settings2, ChevronDown, ChevronUp, FolderPlus,
} from 'lucide-react';
import { format, startOfMonth, subMonths, addMonths } from 'date-fns';
import { es } from 'date-fns/locale';

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

export interface Skill {
  category: string;
  name: string;
  score: number;
  hidden?: boolean;
  custom?: boolean;
  note?: string;
}

export interface CategoryDef {
  name: string;
  hidden?: boolean;
  skills: { name: string; hidden?: boolean }[];
}

export const DEFAULT_ATTITUDE_SKILLS: Skill[] = [
  { category: 'Actitud', name: 'Puntualidad', score: 5 },
  { category: 'Actitud', name: 'Responsabilidad', score: 5 },
  { category: 'Actitud', name: 'Habilidades sociales', score: 5 },
  { category: 'Actitud', name: 'Trabajo en equipo', score: 5 },
  { category: 'Actitud', name: 'Iniciativa', score: 5 },
  { category: 'Actitud', name: 'Adaptabilidad', score: 5 },
];

export const DEFAULT_PERFORMANCE_SKILLS: Skill[] = [
  { category: 'Desempeño', name: 'Productividad', score: 5 },
  { category: 'Desempeño', name: 'Calidad del trabajo', score: 5 },
  { category: 'Desempeño', name: 'Atención al cliente', score: 5 },
  { category: 'Desempeño', name: 'Conocimiento del producto', score: 5 },
  { category: 'Desempeño', name: 'Organización', score: 5 },
  { category: 'Desempeño', name: 'Cumplimiento de metas', score: 5 },
];

export const DEFAULT_LEADERSHIP_SKILLS: Skill[] = [
  { category: 'Liderazgo', name: 'Toma de decisiones', score: 5 },
  { category: 'Liderazgo', name: 'Gestión del tiempo', score: 5 },
  { category: 'Liderazgo', name: 'Resolución de conflictos', score: 5 },
];

const DEFAULT_CATEGORIES: CategoryDef[] = [
  { name: 'Actitud', skills: DEFAULT_ATTITUDE_SKILLS.map(s => ({ name: s.name })) },
  { name: 'Desempeño', skills: DEFAULT_PERFORMANCE_SKILLS.map(s => ({ name: s.name })) },
  { name: 'Liderazgo', skills: DEFAULT_LEADERSHIP_SKILLS.map(s => ({ name: s.name })) },
];

export function getDefaultSkills(position: string): Skill[] {
  const base = [...DEFAULT_ATTITUDE_SKILLS, ...DEFAULT_PERFORMANCE_SKILLS];
  if (position === 'manager') return [...base, ...DEFAULT_LEADERSHIP_SKILLS];
  return base;
}

function getDefaultSkillsFromTemplate(categories: CategoryDef[], position: string): Skill[] {
  const skills: Skill[] = [];
  for (const cat of categories) {
    if (cat.hidden) continue;
    // Skip leadership for non-managers unless template explicitly includes it
    for (const s of cat.skills) {
      if (s.hidden) continue;
      skills.push({ category: cat.name, name: s.name, score: 5 });
    }
  }
  return skills;
}

const CATEGORY_COLORS: Record<string, string> = {
  Actitud: 'hsl(var(--primary))',
  Desempeño: 'hsl(var(--accent-foreground))',
  Liderazgo: 'hsl(var(--destructive))',
};

function getCategoryColor(name: string): string {
  return CATEGORY_COLORS[name] || 'hsl(var(--secondary-foreground))';
}

/** Get weak points (bottom 3 skills) */
export function getWeakPoints(skills: Skill[]): Skill[] {
  const visible = skills.filter(s => !s.hidden);
  return [...visible].sort((a, b) => a.score - b.score).slice(0, 3);
}

/** Get average score */
export function getAvgScore(skills: Skill[]): number {
  const visible = skills.filter(s => !s.hidden);
  if (!visible.length) return 0;
  return visible.reduce((sum, s) => sum + s.score, 0) / visible.length;
}

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
  employeeId, employeeName, position, businessId, branchId, canEdit, onClose,
}: PerformanceChartProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [chartType, setChartType] = useState<'radar' | 'bar'>('bar');
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [skills, setSkills] = useState<Skill[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [compareEmployeeId, setCompareEmployeeId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);

  // Category management state
  const [editingCategoryIdx, setEditingCategoryIdx] = useState<number | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showTemplateSettings, setShowTemplateSettings] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Note expansion state
  const [expandedNoteIdx, setExpandedNoteIdx] = useState<number | null>(null);

  // Moving skill state
  const [movingSkillIdx, setMovingSkillIdx] = useState<number | null>(null);

  const monthKey = formatLocalMonthKey(selectedMonth);

  // Fetch business template
  const { data: templateData } = useQuery({
    queryKey: ['evaluation-template', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('evaluation_templates')
        .select('*')
        .eq('business_id', businessId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!businessId,
  });

  const templateCategories: CategoryDef[] = useMemo(() => {
    if (templateData?.categories) {
      return templateData.categories as unknown as CategoryDef[];
    }
    return DEFAULT_CATEGORIES;
  }, [templateData]);

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

  // Initialize skills
  if (!initialized && !isLoading) {
    if (evaluation?.skills) {
      setSkills(evaluation.skills as unknown as Skill[]);
    } else {
      // Use template if available, otherwise defaults
      setSkills(getDefaultSkillsFromTemplate(templateCategories, position));
    }
    if (evaluation?.notes === '__public__') setIsPublic(true);
    setInitialized(true);
  }

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

  const updateSkillNote = (index: number, note: string) => {
    setSkills(prev => prev.map((s, i) => i === index ? { ...s, note: note || undefined } : s));
  };

  const addCustomSkill = () => {
    if (!newSkillName.trim()) return;
    const category = newSkillCategory || categories[0] || 'Personalizada';
    setSkills(prev => [...prev, { category, name: newSkillName.trim(), score: 5, custom: true }]);
    setNewSkillName('');
  };

  // Move skill up/down within its category
  const moveSkill = (index: number, direction: 'up' | 'down') => {
    setSkills(prev => {
      const arr = [...prev];
      const skill = arr[index];
      // Find siblings in same category
      const categoryIndices = arr.map((s, i) => s.category === skill.category ? i : -1).filter(i => i >= 0);
      const posInCat = categoryIndices.indexOf(index);
      if (direction === 'up' && posInCat <= 0) return prev;
      if (direction === 'down' && posInCat >= categoryIndices.length - 1) return prev;
      const swapIdx = direction === 'up' ? categoryIndices[posInCat - 1] : categoryIndices[posInCat + 1];
      [arr[index], arr[swapIdx]] = [arr[swapIdx], arr[index]];
      return arr;
    });
  };

  // Move skill to different category
  const moveSkillToCategory = (index: number, newCategory: string) => {
    setSkills(prev => prev.map((s, i) => i === index ? { ...s, category: newCategory } : s));
    setMovingSkillIdx(null);
  };

  // Category management
  const categories = [...new Set(skills.map(s => s.category))];

  const renameCategory = (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) return;
    setSkills(prev => prev.map(s => s.category === oldName ? { ...s, category: newName.trim() } : s));
    setEditingCategoryIdx(null);
    setEditCategoryName('');
  };

  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    if (categories.includes(newCategoryName.trim())) {
      toast.error('Esta categoría ya existe');
      return;
    }
    // Add a placeholder skill so the category appears
    setSkills(prev => [...prev, { category: newCategoryName.trim(), name: 'Nueva habilidad', score: 5 }]);
    setNewCategoryName('');
  };

  const toggleCategoryVisibility = (catName: string) => {
    setSkills(prev => {
      const allHidden = prev.filter(s => s.category === catName).every(s => s.hidden);
      return prev.map(s => s.category === catName ? { ...s, hidden: !allHidden } : s);
    });
  };

  // Save template for the business
  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    try {
      const cats: CategoryDef[] = categories.map(catName => {
        const catSkills = skills.filter(s => s.category === catName);
        const allHidden = catSkills.every(s => s.hidden);
        return {
          name: catName,
          hidden: allHidden,
          skills: catSkills.map(s => ({ name: s.name, hidden: s.hidden })),
        };
      });

      if (templateData) {
        const { error } = await supabase
          .from('evaluation_templates')
          .update({ categories: cats as any })
          .eq('id', templateData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('evaluation_templates')
          .insert({ business_id: businessId, categories: cats as any });
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['evaluation-template', businessId] });
      toast.success('Plantilla guardada para futuras evaluaciones');
    } catch (err: any) {
      toast.error(err.message || 'Error al guardar plantilla');
    } finally {
      setSavingTemplate(false);
    }
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
        notes: isPublic ? '__public__' : null,
      };

      if (evaluation) {
        const { error } = await supabase
          .from('employee_evaluations')
          .update({ skills: skills as any, evaluated_by: user.id, notes: isPublic ? '__public__' : null })
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
      queryClient.invalidateQueries({ queryKey: ['my-evaluation'] });
      queryClient.invalidateQueries({ queryKey: ['my-evaluation-history'] });
      queryClient.invalidateQueries({ queryKey: ['my-latest-evaluation'] });
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

  const weakPoints = useMemo(() => getWeakPoints(skills), [skills]);

  // Radar data
  const radarData = visibleSkills.map(s => {
    const base: any = { skill: s.name, score: s.score, fullMark: 10 };
    if (compareEvaluation?.skills) {
      const cs = (compareEvaluation.skills as unknown as Skill[]);
      const match = cs.find(c => c.name === s.name);
      base.compare = match?.score ?? 0;
    }
    return base;
  });

  // Bar data – sorted by score
  const barData = [...visibleSkills].sort((a, b) => a.score - b.score).map(s => {
    const base: any = { skill: s.name, score: s.score };
    if (compareEvaluation?.skills) {
      const cs = (compareEvaluation.skills as unknown as Skill[]);
      const match = cs.find(c => c.name === s.name);
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
      month: format(parseLocalDate(h.evaluation_month), 'MMM yy', { locale: es }),
      promedio: parseFloat(avg.toFixed(1)),
    };
  });

  // Yearly skill-by-skill breakdown
  const yearlySkillData = useMemo(() => {
    if (history.length < 2) return [];
    const skillNames = new Set<string>();
    history.forEach(h => {
      (h.skills as unknown as Skill[]).forEach(s => { if (!s.hidden) skillNames.add(s.name); });
    });
    return Array.from(skillNames).map(name => {
      const scores = history.map(h => {
        const s = (h.skills as unknown as Skill[]).find(sk => sk.name === name);
        return s?.score ?? 0;
      });
      const latest = scores[scores.length - 1];
      const first = scores[0];
      return { name, latest, first, change: latest - first };
    }).sort((a, b) => a.change - b.change);
  }, [history]);

  // Color for bar based on weak point threshold
  const getBarColor = (_score: number) => {
    return 'hsl(var(--primary))';
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-3 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Activity className="h-5 w-5" />
            Evaluación de {employeeName}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Puntuaciones de habilidades y desempeño
          </DialogDescription>
        </DialogHeader>

        {/* Month selector */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => handleMonthChange('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-medium capitalize text-sm sm:text-base">
            {format(selectedMonth, 'MMMM yyyy', { locale: es })}
          </span>
          <Button variant="ghost" size="icon" onClick={() => handleMonthChange('next')}
            disabled={selectedMonth >= startOfMonth(new Date())}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <Tabs defaultValue="chart" className="w-full">
            <TabsList className="w-full flex overflow-x-auto scrollbar-none gap-1 p-1">
              <TabsTrigger value="chart" className="text-xs sm:text-sm flex-shrink-0">Gráfica</TabsTrigger>
              <TabsTrigger value="skills" className="text-xs sm:text-sm flex-shrink-0">Evaluaciones</TabsTrigger>
              <TabsTrigger value="history" className="text-xs sm:text-sm flex-shrink-0">Historial</TabsTrigger>
              <TabsTrigger value="development" className="text-xs sm:text-sm flex-shrink-0">Desarrollo</TabsTrigger>
            </TabsList>

            {/* ===== Chart tab ===== */}
            <TabsContent value="chart" className="space-y-3">
              <div className="flex items-center flex-wrap gap-2">
                <Button variant={chartType === 'radar' ? 'default' : 'outline'} size="sm"
                  onClick={() => setChartType('radar')}>
                  <Activity className="h-4 w-4 mr-1" /> Radar
                </Button>
                <Button variant={chartType === 'bar' ? 'default' : 'outline'} size="sm"
                  onClick={() => setChartType('bar')}>
                  <BarChart3 className="h-4 w-4 mr-1" /> Barras
                </Button>
                <Select value={compareEmployeeId || 'none'}
                  onValueChange={(v) => setCompareEmployeeId(v === 'none' ? null : v)}>
                  <SelectTrigger className="w-[160px] sm:w-[200px] text-xs sm:text-sm h-8">
                    <Users className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                    <SelectValue placeholder="Comparación" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin comparación</SelectItem>
                    {branchEmployees.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="secondary" className="text-xs sm:text-sm ml-auto">
                  Promedio: {avgScore}/10
                </Badge>
              </div>

              <div className={`w-full ${chartType === 'bar' ? '' : 'h-[320px] sm:h-[420px]'}`}
                style={chartType === 'bar' ? { height: Math.max(320, barData.length * 44) } : undefined}>
                {chartType === 'radar' ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="45%">
                      <PolarGrid />
                      <PolarAngleAxis dataKey="skill" tick={({ x, y, cx, cy, payload }) => {
                        const words = (payload.value as string).split(' ');
                        const dx = x - cx;
                        const dy = y - cy;
                        const len = Math.sqrt(dx * dx + dy * dy) || 1;
                        const offsetX = x + (dx / len) * 16;
                        const offsetY = y + (dy / len) * 16;
                        const anchor = Math.abs(dx) < 5 ? 'middle' : dx > 0 ? 'start' : 'end';
                        return (
                          <text x={offsetX} y={offsetY} textAnchor={anchor} className="fill-muted-foreground" style={{ fontSize: 11 }}>
                            {words.map((w, i) => (
                              <tspan key={i} x={offsetX} dy={i === 0 ? 0 : 13}>{w}</tspan>
                            ))}
                          </text>
                        );
                      }} />
                      <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} />
                      <Radar name={employeeName} dataKey="score"
                        stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                      {compareEmployeeId && (
                        <Radar name="Comparación" dataKey="compare"
                          stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.15} />
                      )}
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 15, top: 5, bottom: 5 }}
                      barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 13 }} />
                      <YAxis type="category" dataKey="skill" tick={{ fontSize: 13 }} width={130} />
                      <Tooltip contentStyle={{ ...rechartsTooltipStyle.contentStyle, fontSize: 13 }} labelStyle={rechartsTooltipStyle.labelStyle} itemStyle={rechartsTooltipStyle.itemStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="score" name={employeeName} radius={[0, 6, 6, 0]} barSize={16}>
                        {barData.map((entry, i) => (
                          <Cell key={i} fill={getBarColor(entry.score)} />
                        ))}
                      </Bar>
                      {compareEmployeeId && (
                        <Bar dataKey="compare" name="Comparación"
                          fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} barSize={10} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Weak points summary */}
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <h4 className="text-xs sm:text-sm font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Puntos más débiles
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {weakPoints.map(wp => (
                    <Badge key={wp.name} variant="outline"
                      className="text-xs border-destructive/50 text-destructive">
                      {wp.name}: {wp.score}/10
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ===== Skills editing tab ===== */}
            <TabsContent value="skills" className="space-y-4">
              {/* Visibility toggle */}
              {canEdit && (
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-2">
                    {isPublic ? <Globe className="h-4 w-4 text-primary" /> : <Lock className="h-4 w-4 text-muted-foreground" />}
                    <div>
                      <p className="text-sm font-medium">Visible para otros</p>
                      <p className="text-xs text-muted-foreground">Permitir que otros vean esta evaluación</p>
                    </div>
                  </div>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>
              )}

              {/* Template settings toggle */}
              {canEdit && (
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowTemplateSettings(!showTemplateSettings)}>
                  <Settings2 className="h-4 w-4" />
                  Gestionar categorías
                  {showTemplateSettings ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              )}

              {/* Category management panel */}
              {canEdit && showTemplateSettings && (
                <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Renombra, oculta o añade categorías. Los cambios se guardan como plantilla del negocio.
                  </p>

                  {categories.map((cat, catIdx) => {
                    const allHidden = skills.filter(s => s.category === cat).every(s => s.hidden);
                    return (
                      <div key={cat} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getCategoryColor(cat) }} />
                        {editingCategoryIdx === catIdx ? (
                          <Input
                            value={editCategoryName}
                            onChange={e => setEditCategoryName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') renameCategory(cat, editCategoryName); if (e.key === 'Escape') setEditingCategoryIdx(null); }}
                            onBlur={() => renameCategory(cat, editCategoryName)}
                            className="h-7 text-xs flex-1"
                            autoFocus
                          />
                        ) : (
                          <span className={`text-xs sm:text-sm font-medium flex-1 ${allHidden ? 'line-through text-muted-foreground' : ''}`}>{cat}</span>
                        )}
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingCategoryIdx(catIdx); setEditCategoryName(cat); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleCategoryVisibility(cat)}>
                          {allHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                      </div>
                    );
                  })}

                  <div className="flex items-center gap-2 pt-1">
                    <Input placeholder="Nueva categoría" value={newCategoryName}
                      onChange={e => setNewCategoryName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addCategory()}
                      className="h-7 text-xs flex-1" />
                    <Button size="sm" variant="outline" onClick={addCategory} disabled={!newCategoryName.trim()} className="h-7 text-xs gap-1">
                      <FolderPlus className="h-3 w-3" /> Añadir
                    </Button>
                  </div>

                  <Button size="sm" variant="secondary" onClick={handleSaveTemplate} disabled={savingTemplate} className="w-full gap-2">
                    {savingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Guardar como plantilla del negocio
                  </Button>
                </div>
              )}

              {/* Skills by category */}
              {categories.map(cat => {
                const catSkills = skills.map((s, i) => ({ ...s, _idx: i })).filter(s => s.category === cat);
                const allHidden = catSkills.every(s => s.hidden);
                if (allHidden && !showTemplateSettings) return null;

                return (
                  <div key={cat} className="space-y-2">
                    <h4 className={`font-semibold text-xs sm:text-sm flex items-center gap-2 ${allHidden ? 'opacity-40' : ''}`}>
                      <div className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: getCategoryColor(cat) }} />
                      {cat}
                      {allHidden && <Badge variant="outline" className="text-[10px]">Oculta</Badge>}
                    </h4>
                    <div className="space-y-2">
                      {catSkills.map((skill, posInCat) => {
                        const idx = skill._idx;
                        return (
                          <div key={`${skill.name}-${idx}`}
                            className={`rounded-lg border p-2 ${skill.hidden ? 'opacity-40' : ''}`}>
                            <div className="flex items-center gap-2">
                              {/* Reorder buttons */}
                              {canEdit && !skill.hidden && (
                                <div className="flex flex-col gap-0.5">
                                  <Button variant="ghost" size="icon" className="h-5 w-5"
                                    onClick={() => moveSkill(idx, 'up')} disabled={posInCat === 0}>
                                    <ArrowUp className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-5 w-5"
                                    onClick={() => moveSkill(idx, 'down')} disabled={posInCat === catSkills.length - 1}>
                                    <ArrowDown className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}

                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs sm:text-sm font-medium truncate">{skill.name}</span>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs sm:text-sm font-bold w-6 text-center">{skill.score}</span>
                                    {canEdit && (
                                      <>
                                        {/* Move to category */}
                                        {categories.length > 1 && (
                                          <Button variant="ghost" size="icon" className="h-6 w-6"
                                            onClick={() => setMovingSkillIdx(movingSkillIdx === idx ? null : idx)}>
                                            <ArrowRightLeft className="h-3 w-3" />
                                          </Button>
                                        )}
                                        {/* Note toggle */}
                                        <Button variant="ghost" size="icon" className="h-6 w-6"
                                          onClick={() => setExpandedNoteIdx(expandedNoteIdx === idx ? null : idx)}>
                                          <MessageSquare className={`h-3 w-3 ${skill.note ? 'text-primary' : ''}`} />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6"
                                          onClick={() => toggleSkillVisibility(idx)}>
                                          {skill.hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                                {canEdit && !skill.hidden && (
                                  <Slider value={[skill.score]} onValueChange={([v]) => updateSkillScore(idx, v)}
                                    min={1} max={10} step={1} className="mt-1" />
                                )}
                              </div>
                            </div>

                            {/* Move to category selector */}
                            {canEdit && movingSkillIdx === idx && (
                              <div className="mt-2 flex items-center gap-2 pl-8">
                                <span className="text-xs text-muted-foreground">Mover a:</span>
                                {categories.filter(c => c !== cat).map(c => (
                                  <Button key={c} variant="outline" size="sm" className="h-6 text-[10px]"
                                    onClick={() => moveSkillToCategory(idx, c)}>
                                    {c}
                                  </Button>
                                ))}
                              </div>
                            )}

                            {/* Note field */}
                            {expandedNoteIdx === idx && (
                              <div className="mt-2 pl-8">
                                <Textarea
                                  placeholder="Nota sobre esta puntuación..."
                                  value={skill.note || ''}
                                  onChange={e => updateSkillNote(idx, e.target.value)}
                                  className="text-xs min-h-[60px] resize-none"
                                  rows={2}
                                />
                              </div>
                            )}

                            {/* Show note indicator when collapsed */}
                            {skill.note && expandedNoteIdx !== idx && (
                              <p className="text-[10px] text-muted-foreground mt-1 pl-8 truncate italic">
                                "{skill.note}"
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {canEdit && (
                <div className="flex items-end gap-2 pt-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Habilidad personalizada</Label>
                    <Input placeholder="Nombre de la habilidad" value={newSkillName}
                      onChange={e => setNewSkillName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addCustomSkill()} />
                  </div>
                  <Select value={newSkillCategory || categories[0] || ''} onValueChange={setNewSkillCategory}>
                    <SelectTrigger className="w-[120px] h-10 text-xs">
                      <SelectValue placeholder="Categoría" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(c => (
                        <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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

            {/* ===== History tab ===== */}
            <TabsContent value="history" className="space-y-4">
              {historyData.length > 1 ? (
                <div className="w-full h-[250px] sm:h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ ...rechartsTooltipStyle.contentStyle, fontSize: 12 }} labelStyle={rechartsTooltipStyle.labelStyle} itemStyle={rechartsTooltipStyle.itemStyle} />
                      <ReferenceLine y={5} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" label={{ value: 'Base', fontSize: 10 }} />
                      <Line type="monotone" dataKey="promedio" stroke="hsl(var(--primary))"
                        strokeWidth={2} dot={{ r: 5 }} name="Promedio" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <Activity className="mx-auto h-12 w-12 opacity-50 mb-2" />
                  <p className="text-sm">Se necesitan al menos 2 meses para mostrar el historial.</p>
                </div>
              )}

              {history.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs sm:text-sm font-semibold">Meses evaluados</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {history.map(h => (
                      <Badge key={h.evaluation_month}
                        variant={h.evaluation_month === monthKey ? 'default' : 'outline'}
                        className="cursor-pointer capitalize text-xs"
                        onClick={() => { setInitialized(false); setSelectedMonth(new Date(h.evaluation_month)); }}>
                        {format(new Date(h.evaluation_month), 'MMM yy', { locale: es })}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ===== Development / Yearly tab ===== */}
            <TabsContent value="development" className="space-y-4">
              {yearlySkillData.length > 0 ? (
                <>
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <h4 className="text-xs sm:text-sm font-semibold flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      Desarrollo por habilidad
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Cambio desde la primera evaluación hasta la más reciente
                    </p>
                  </div>

                  <div className="w-full h-[300px] sm:h-[380px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={yearlySkillData} layout="vertical" margin={{ left: 10, right: 20 }}
                        barCategoryGap="25%">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 12 }}
                          label={{ value: 'Cambio', position: 'insideBottomRight', fontSize: 11, offset: -5 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                        <Tooltip contentStyle={{ fontSize: 12 }}
                          formatter={(v: number) => [`${v > 0 ? '+' : ''}${v}`, 'Cambio']} />
                        <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" />
                        <Bar dataKey="change" radius={[0, 4, 4, 0]} barSize={14}>
                          {yearlySkillData.map((entry, i) => (
                            <Cell key={i} fill={entry.change >= 0 ? 'hsl(var(--primary))' : 'hsl(var(--destructive))'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Weak areas highlight */}
                  <div className="space-y-2">
                    <h4 className="text-xs sm:text-sm font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Áreas que necesitan atención
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {yearlySkillData.filter(s => s.change < 0 || s.latest <= 4).slice(0, 4).map(s => (
                        <div key={s.name} className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-2.5">
                          <span className="text-xs sm:text-sm font-medium">{s.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{s.first}→{s.latest}</span>
                            <Badge variant={s.change >= 0 ? 'secondary' : 'destructive'} className="text-xs">
                              {s.change > 0 ? '+' : ''}{s.change}
                            </Badge>
                          </div>
                        </div>
                      ))}
                      {yearlySkillData.filter(s => s.change < 0 || s.latest <= 4).length === 0 && (
                        <p className="text-xs text-muted-foreground col-span-2">
                          ¡Excelente! No hay áreas críticas detectadas.
                        </p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <TrendingUp className="mx-auto h-12 w-12 opacity-50 mb-2" />
                  <p className="text-sm">Se necesitan al menos 2 evaluaciones para mostrar el desarrollo.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
