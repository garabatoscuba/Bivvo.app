import { useState, useEffect } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Settings, BookOpen, GraduationCap, History, Zap, Plus, Pencil, Trash2, Loader2, MessageSquare, ChevronDown, ChevronRight, Sparkles, Megaphone } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import IconSelector, { getIconComponent } from '@/components/services/IconSelector';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ─── Config Global Tab ───
function ConfigGlobalTab() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['assistant-config'],
    queryFn: async () => {
      const { data } = await supabase.from('assistant_config').select('*').limit(1).single();
      return data;
    },
  });

  const { data: actions = [], isLoading: actionsLoading } = useQuery({
    queryKey: ['assistant-context-actions-admin'],
    queryFn: async () => {
      const { data } = await supabase.from('assistant_context_actions').select('*').order('sort_order');
      return (data || []) as any[];
    },
  });

  const [tone, setTone] = useState<string>('');
  const [enabled, setEnabled] = useState(true);
  const [instructions, setInstructions] = useState('');
  const [assistantName, setAssistantName] = useState('Bivoo');
  const [configId, setConfigId] = useState<string | null>(null);

  // Action dialog
  const [actionDialog, setActionDialog] = useState(false);
  const [editingAction, setEditingAction] = useState<any>(null);
  const [actionLabel, setActionLabel] = useState('');
  const [actionIcon, setActionIcon] = useState('Zap');
  const [actionType, setActionType] = useState('navigate');
  const [actionPayload, setActionPayload] = useState('');
  const [deleteActionTarget, setDeleteActionTarget] = useState<any>(null);

  // Sync local state when config loads
  useEffect(() => {
    if (config) {
      setTone(config.tone);
      setEnabled(config.is_enabled);
      setInstructions(config.base_instructions);
      setAssistantName((config as any).assistant_name || 'Bivoo');
      setConfigId(config.id);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!configId) throw new Error('No config loaded');
      const { error } = await supabase.from('assistant_config').update({
        tone, is_enabled: enabled, base_instructions: instructions, assistant_name: assistantName,
      } as any).eq('id', configId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assistant-config'] }); qc.invalidateQueries({ queryKey: ['assistant-config-name'] }); qc.invalidateQueries({ queryKey: ['assistant-features-access'] }); toast({ title: 'Configuración guardada' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const saveActionMutation = useMutation({
    mutationFn: async () => {
      const payload = { label: actionLabel, icon: actionIcon, action_type: actionType, action_payload: { value: actionPayload }, is_active: true, sort_order: actions.length };
      if (editingAction) {
        const { error } = await supabase.from('assistant_context_actions').update(payload as any).eq('id', editingAction.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('assistant_context_actions').insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assistant-context-actions-admin'] }); setActionDialog(false); toast({ title: editingAction ? 'Acción actualizada' : 'Acción creada' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteActionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assistant_context_actions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assistant-context-actions-admin'] }); setDeleteActionTarget(null); toast({ title: 'Acción eliminada' }); },
  });

  const openNewAction = () => {
    setEditingAction(null); setActionLabel(''); setActionIcon('Zap'); setActionType('navigate'); setActionPayload(''); setActionDialog(true);
  };
  const openEditAction = (a: any) => {
    setEditingAction(a); setActionLabel(a.label); setActionIcon(a.icon); setActionType(a.action_type); setActionPayload(a.action_payload?.value || ''); setActionDialog(true);
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Configuración general</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm">Nombre del asistente</Label>
            <Input value={assistantName} onChange={e => setAssistantName(e.target.value)} placeholder="Bivoo" className="mt-1 max-w-xs" />
            <p className="text-[11px] text-muted-foreground mt-1">Se muestra como "Asistente {assistantName}" en el panel.</p>
          </div>
          <div className="flex items-center justify-between">
            <Label>Asistente activo en toda la plataforma</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div>
            <Label className="text-sm">Tono del asistente</Label>
            <Select value={tone} onValueChange={setTone}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="formal">Formal</SelectItem>
                <SelectItem value="friendly">Amigable</SelectItem>
                <SelectItem value="technical">Técnico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-sm">Instrucciones base (aplican a todos los negocios)</Label>
            <Textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={6} className="mt-1" placeholder="Escribe instrucciones que la IA debe seguir siempre..." />
          </div>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Guardar configuración
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle className="text-base">Botones del menú contextual</CardTitle><CardDescription>Todos los botones del menú son editables. Puedes cambiar nombre, icono y acción.</CardDescription></div>
          <Button size="sm" onClick={openNewAction}><Plus className="h-4 w-4 mr-1" /> Agregar</Button>
        </CardHeader>
        <CardContent>
          {actionsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay botones configurados.</p>
          ) : (
            <div className="space-y-2">
              {actions.map(a => {
                const Icon = getIconComponent(a.icon);
                return (
                  <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg border">
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm flex-1">{a.label}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {a.action_type === 'treasury_action' ? 'Caja' : a.action_type === 'navigate' ? 'Navegar' : a.action_type}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {a.action_payload?.value || '—'}
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditAction(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteActionTarget(a)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action dialog */}
      <Dialog open={actionDialog} onOpenChange={setActionDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingAction ? 'Editar acción' : 'Nueva acción'}</DialogTitle><DialogDescription>Configura un botón para el menú contextual del asistente.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Etiqueta</Label><Input value={actionLabel} onChange={e => setActionLabel(e.target.value)} placeholder="Ej: Ver Reportes" className="mt-1" /></div>
            <IconSelector value={actionIcon} onChange={setActionIcon} />
            <div>
              <Label>Tipo de acción</Label>
              <Select value={actionType} onValueChange={setActionType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="navigate">Navegar a ruta</SelectItem>
                  <SelectItem value="treasury_action">Acción de Caja</SelectItem>
                  <SelectItem value="open_module">Abrir módulo</SelectItem>
                  <SelectItem value="quick_action">Acción rápida</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                {actionType === 'treasury_action' ? 'Valor: "gasto" o "capital"' : actionType === 'navigate' ? 'Ruta del sistema, ej: /caja' : 'Identificador del recurso'}
              </p>
            </div>
            <div><Label>{actionType === 'navigate' ? 'Ruta del sistema' : 'Valor'}</Label><Input value={actionPayload} onChange={e => setActionPayload(e.target.value)} placeholder={actionType === 'navigate' ? '/caja' : actionType === 'treasury_action' ? 'gasto' : 'valor'} className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveActionMutation.mutate()} disabled={!actionLabel.trim() || saveActionMutation.isPending}>
              {saveActionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingAction ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteActionTarget} onOpenChange={() => setDeleteActionTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Eliminar acción</AlertDialogTitle><AlertDialogDescription>¿Eliminar "{deleteActionTarget?.label}"?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteActionMutation.mutate(deleteActionTarget?.id)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Instructions Per Business Type Tab ───
function InstructionsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['assistant-bt-instructions'],
    queryFn: async () => {
      const { data } = await supabase.from('assistant_business_type_instructions').select('*').order('business_type');
      return (data || []) as any[];
    },
  });

  const [values, setValues] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);

  if (!initialized && items.length > 0) {
    const v: Record<string, string> = {};
    items.forEach(i => { v[i.business_type] = i.instructions; });
    setValues(v);
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (bt: string) => {
      const { error } = await supabase.from('assistant_business_type_instructions').update({ instructions: values[bt] || '' } as any).eq('business_type', bt);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assistant-bt-instructions'] }); toast({ title: 'Instrucciones guardadas' }); },
  });

  const labels: Record<string, string> = { store: 'Tienda', copy_shop: 'Punto de Copias', gym: 'Gimnasio' };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      {items.map(item => (
        <Card key={item.id}>
          <CardHeader><CardTitle className="text-base">{labels[item.business_type] || item.business_type}</CardTitle><CardDescription>Instrucciones inyectadas cuando el usuario pertenece a este tipo de negocio.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            <Textarea value={values[item.business_type] || ''} onChange={e => setValues(p => ({ ...p, [item.business_type]: e.target.value }))} rows={5} placeholder="Instrucciones específicas..." />
            <Button size="sm" onClick={() => saveMutation.mutate(item.business_type)} disabled={saveMutation.isPending}>Guardar</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Training Examples Tab ───
function TrainingTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: examples = [], isLoading } = useQuery({
    queryKey: ['assistant-training'],
    queryFn: async () => {
      const { data } = await supabase.from('assistant_training_examples').select('*').order('sort_order');
      return (data || []) as any[];
    },
  });

  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { question, answer, is_active: true, sort_order: examples.length };
      if (editing) {
        const { error } = await supabase.from('assistant_training_examples').update(payload as any).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('assistant_training_examples').insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assistant-training'] }); setDialog(false); toast({ title: editing ? 'Ejemplo actualizado' : 'Ejemplo creado' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assistant_training_examples').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['assistant-training'] }); setDeleteTarget(null); toast({ title: 'Ejemplo eliminado' }); },
  });

  const openNew = () => { setEditing(null); setQuestion(''); setAnswer(''); setDialog(true); };
  const openEdit = (e: any) => { setEditing(e); setQuestion(e.question); setAnswer(e.answer); setDialog(true); };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Pares de pregunta-respuesta que la IA usa como ejemplos en su prompt.</p>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Agregar</Button>
      </div>
      {examples.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No hay ejemplos de entrenamiento.</CardContent></Card>
      ) : examples.map(e => (
        <Card key={e.id}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">P: {e.question}</p>
                <p className="text-sm text-muted-foreground mt-1">R: {e.answer}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(e)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar ejemplo' : 'Nuevo ejemplo'}</DialogTitle><DialogDescription>Escribe un par de pregunta y respuesta ideal.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Pregunta</Label><Textarea value={question} onChange={e => setQuestion(e.target.value)} rows={2} className="mt-1" /></div>
            <div><Label>Respuesta ideal</Label><Textarea value={answer} onChange={e => setAnswer(e.target.value)} rows={4} className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!question.trim() || !answer.trim() || saveMutation.isPending}>{editing ? 'Guardar' : 'Crear'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Eliminar ejemplo</AlertDialogTitle><AlertDialogDescription>¿Eliminar este ejemplo de entrenamiento?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(deleteTarget?.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── History Tab ───
function HistoryTab() {
  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['assistant-conversations'],
    queryFn: async () => {
      const { data } = await supabase.from('assistant_conversations').select('*').order('updated_at', { ascending: false }).limit(100);
      return (data || []) as any[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['assistant-conv-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name, email, business_id');
      return (data || []) as any[];
    },
  });

  const { data: businesses = [] } = useQuery({
    queryKey: ['assistant-conv-businesses'],
    queryFn: async () => {
      const { data } = await supabase.from('businesses').select('id, name');
      return (data || []) as any[];
    },
  });

  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  if (conversations.length === 0) return <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No hay conversaciones registradas.</CardContent></Card>;

  // Group by business
  const grouped: Record<string, any[]> = {};
  conversations.forEach(c => {
    const biz = businesses.find(b => b.id === c.business_id);
    const key = biz?.name || 'Sin negocio';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  });

  const roleLabels: Record<string, string> = { owner: 'Dueño', manager: 'Gerente', seller: 'Vendedor', viewer: 'Visitante' };

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([bizName, convs]) => (
        <Card key={bizName}>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{bizName}</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {convs.map(c => {
              const prof = profiles.find(p => p.user_id === c.user_id);
              const msgs = Array.isArray(c.messages) ? c.messages : [];
              const isOpen = expanded === c.id;
              return (
                <div key={c.id} className="border rounded-lg">
                  <button onClick={() => setExpanded(isOpen ? null : c.id)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors">
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
                    <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm flex-1 truncate">{prof?.full_name || prof?.email || 'Usuario'}</span>
                    <Badge variant="outline" className="text-[10px]">{roleLabels[c.user_role] || c.user_role}</Badge>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(c.updated_at), 'dd MMM HH:mm', { locale: es })}</span>
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2 max-h-[300px] overflow-y-auto">
                      {msgs.map((m: any, i: number) => (
                        <div key={i} className={`text-xs p-2 rounded-lg ${m.role === 'user' ? 'bg-primary/10 ml-4' : 'bg-muted/60 mr-4'}`}>
                          <span className="font-medium text-[10px] uppercase text-muted-foreground">{m.role === 'user' ? 'Usuario' : 'IA'}</span>
                          <p className="mt-0.5 whitespace-pre-wrap">{m.content}</p>
                        </div>
                      ))}
                      {msgs.length === 0 && <p className="text-xs text-muted-foreground">Sin mensajes.</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─── Quick Actions Summary Tab ───
function QuickActionsTab() {
  const { data: actions = [], isLoading } = useQuery({
    queryKey: ['assistant-context-actions-admin'],
    queryFn: async () => {
      const { data } = await supabase.from('assistant_context_actions').select('*').eq('is_active', true).order('sort_order');
      return (data || []) as any[];
    },
  });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Resumen visual de los botones activos en el menú contextual del asistente.</p>
      {actions.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No hay acciones rápidas configuradas. Agrégalas desde la pestaña Configuración.</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {actions.map(a => {
            const Icon = getIconComponent(a.icon);
            return (
              <Card key={a.id}>
                <CardContent className="pt-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.label}</p>
                    <p className="text-[11px] text-muted-foreground">{a.action_type}: {a.action_payload?.value || '—'}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Lazy-loaded new tabs ───
import AssistantFeaturesTab from '@/components/admin/AssistantFeaturesTab';
import AnnouncementsTab from '@/components/admin/AnnouncementsTab';

// ─── Main Page ───
export default function AdminAssistant() {
  return (
    <AppLayout title="Asistente IA">
      <Tabs defaultValue="config" className="space-y-6">
        <div className="overflow-x-auto">
          <TabsList className="bg-muted/60">
            <TabsTrigger value="config" className="gap-1.5 text-xs"><Settings className="h-3.5 w-3.5" /> Configuración</TabsTrigger>
            <TabsTrigger value="features" className="gap-1.5 text-xs"><Sparkles className="h-3.5 w-3.5" /> Funciones</TabsTrigger>
            <TabsTrigger value="announcements" className="gap-1.5 text-xs"><Megaphone className="h-3.5 w-3.5" /> Anuncios</TabsTrigger>
            <TabsTrigger value="instructions" className="gap-1.5 text-xs"><BookOpen className="h-3.5 w-3.5" /> Por tipo</TabsTrigger>
            <TabsTrigger value="training" className="gap-1.5 text-xs"><GraduationCap className="h-3.5 w-3.5" /> Entrenamiento</TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs"><History className="h-3.5 w-3.5" /> Historial</TabsTrigger>
            <TabsTrigger value="actions" className="gap-1.5 text-xs"><Zap className="h-3.5 w-3.5" /> Acciones</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="config"><ConfigGlobalTab /></TabsContent>
        <TabsContent value="features"><AssistantFeaturesTab /></TabsContent>
        <TabsContent value="announcements"><AnnouncementsTab /></TabsContent>
        <TabsContent value="instructions"><InstructionsTab /></TabsContent>
        <TabsContent value="training"><TrainingTab /></TabsContent>
        <TabsContent value="history"><HistoryTab /></TabsContent>
        <TabsContent value="actions"><QuickActionsTab /></TabsContent>
      </Tabs>
    </AppLayout>
  );
}
