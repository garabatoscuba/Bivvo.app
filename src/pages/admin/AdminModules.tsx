import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Package, Puzzle, DollarSign, Plus, Pencil, Loader2, Trash2, Tag, Building2, X, Search, Users, Store, GripVertical,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import IconSelector from '@/components/services/IconSelector';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ─── Types ───────────────────────────────────────────────────────────
interface PlatformModule {
  id: string;
  name: string;
  icon: string;
  description: string | null;
  sidebar_label: string;
  business_types: string[];
  countries: string[];
  is_active: boolean;
  sort_order: number;
}

interface ModuleAssignment {
  id: string;
  module_id: string;
  target_type: 'user' | 'business';
  target_id: string;
  created_at: string;
}

interface PlatformPlugin {
  id: string;
  name: string;
  description: string | null;
  module_ids: string[];
  countries: string[];
  is_active: boolean;
  sort_order: number;
}

interface BusinessTypeConfig {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string;
  country: string | null;
  is_active: boolean;
  module_ids: string[];
  config: Record<string, any>;
  sort_order: number;
}

interface ModulePluginPricing {
  id: string;
  entity_type: string;
  entity_id: string;
  plan_type: string;
  availability: string;
  monthly_price: number;
}

interface PricingOffer {
  id: string;
  name: string;
  description: string | null;
  discount_percent: number;
  expires_at: string | null;
  entity_type: string;
  entity_id: string;
  is_active: boolean;
}

const BUSINESS_TYPES = [
  { value: 'store', label: 'Tienda' },
  { value: 'copy_shop', label: 'Punto de Copias' },
  { value: 'gym', label: 'Gimnasio' },
];

const COUNTRIES = [
  { value: 'cuba', label: 'Cuba' },
  { value: 'mexico', label: 'México' },
  { value: 'usa', label: 'Estados Unidos' },
];

const PLAN_TYPES = [
  { value: 'free', label: 'Gratuito' },
  { value: 'basic', label: 'Básico' },
  { value: 'professional', label: 'Profesional' },
];

const AVAILABILITY_OPTIONS = [
  { value: 'included', label: 'Incluido gratis' },
  { value: 'paid_addon', label: 'Pago adicional' },
  { value: 'unavailable', label: 'No disponible' },
];

// ─── Sortable Row Component ──────────────────────────────────────────
const SortableModuleRow = ({ module, onEdit, onToggle }: { module: PlatformModule; onEdit: () => void; onToggle: (active: boolean) => void }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className={isDragging ? 'relative z-50' : ''}>
      <TableCell className="w-8">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded transition-colors"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
      </TableCell>
      <TableCell>
        <div>
          <p className="text-sm font-medium">{module.name}</p>
          {module.description && <p className="text-[11px] text-muted-foreground line-clamp-1">{module.description}</p>}
        </div>
      </TableCell>
      <TableCell><Badge variant="outline" className="text-[11px]">{module.sidebar_label}</Badge></TableCell>
      <TableCell>
        <div className="flex gap-1 flex-wrap">
          {module.business_types.map(t => (
            <Badge key={t} variant="secondary" className="text-[10px]">{BUSINESS_TYPES.find(bt => bt.value === t)?.label || t}</Badge>
          ))}
        </div>
      </TableCell>
      <TableCell>
        {module.countries.length === 0
          ? <span className="text-[11px] text-muted-foreground">Global</span>
          : module.countries.map(c => <Badge key={c} variant="secondary" className="text-[10px] mr-1">{COUNTRIES.find(cc => cc.value === c)?.label || c}</Badge>)
        }
      </TableCell>
      <TableCell className="text-center">
        <Switch checked={module.is_active} onCheckedChange={onToggle} />
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
};

// ─── Módulos Tab ─────────────────────────────────────────────────────
const ModulesTab = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformModule | null>(null);
  const [form, setForm] = useState({ name: '', icon: 'Package', description: '', sidebar_label: '', business_types: ['store'] as string[], countries: [] as string[], sort_order: 0 });
  const [assignSearch, setAssignSearch] = useState('');
  const [assignTab, setAssignTab] = useState<'user' | 'business'>('user');

  const { data: modules = [], isLoading } = useQuery({
    queryKey: ['platform-modules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('platform_modules').select('*').order('sort_order');
      if (error) throw error;
      return (data || []) as PlatformModule[];
    },
  });

  // Fetch assignments for current editing module
  const { data: assignments = [] } = useQuery({
    queryKey: ['module-assignments', editing?.id],
    queryFn: async () => {
      if (!editing?.id) return [];
      const { data, error } = await supabase.from('module_assignments').select('*').eq('module_id', editing.id);
      if (error) throw error;
      return (data || []) as ModuleAssignment[];
    },
    enabled: !!editing?.id,
  });

  // Fetch all profiles for user search
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['admin-profiles-for-assign'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, full_name, email').order('full_name');
      if (error) throw error;
      return data || [];
    },
    enabled: dialogOpen && !!editing,
  });

  // Fetch all businesses for business search
  const { data: allBusinesses = [] } = useQuery({
    queryKey: ['admin-businesses-for-assign'],
    queryFn: async () => {
      const { data, error } = await supabase.from('businesses').select('id, name').order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: dialogOpen && !!editing,
  });

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const reorderMutation = useMutation({
    mutationFn: async (reorderedModules: PlatformModule[]) => {
      const updates = reorderedModules.map((m, index) => ({
        id: m.id,
        sort_order: index + 1,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('platform_modules')
          .update({ sort_order: update.sort_order } as any)
          .eq('id', update.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-modules'] });
      toast({ title: 'Orden actualizado' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = modules.findIndex((m) => m.id === active.id);
      const newIndex = modules.findIndex((m) => m.id === over.id);

      const reordered = arrayMove(modules, oldIndex, newIndex);
      reorderMutation.mutate(reordered);
    }
  };

  const addAssignment = useMutation({
    mutationFn: async ({ target_type, target_id }: { target_type: string; target_id: string }) => {
      const { error } = await supabase.from('module_assignments').insert({ module_id: editing!.id, target_type, target_id } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['module-assignments', editing?.id] });
      toast({ title: 'Asignación agregada' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const removeAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('module_assignments').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['module-assignments', editing?.id] });
      toast({ title: 'Asignación eliminada' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        icon: form.icon,
        description: form.description || null,
        sidebar_label: form.sidebar_label,
        business_types: form.business_types,
        countries: form.countries,
        sort_order: form.sort_order,
      };
      if (editing) {
        const { error } = await supabase.from('platform_modules').update(payload as any).eq('id', editing.id);
        if (error) throw error;
      } else {
        const maxOrder = Math.max(0, ...modules.map(m => m.sort_order));
        const { error } = await supabase.from('platform_modules').insert({ ...payload, sort_order: maxOrder + 1 } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-modules'] });
      toast({ title: editing ? 'Módulo actualizado' : 'Módulo creado' });
      setDialogOpen(false);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('platform_modules').update({ is_active } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-modules'] }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', icon: 'Package', description: '', sidebar_label: '', business_types: ['store'], countries: [], sort_order: 0 });
    setDialogOpen(true);
  };

  const openEdit = (m: PlatformModule) => {
    setEditing(m);
    setForm({ name: m.name, icon: m.icon, description: m.description || '', sidebar_label: m.sidebar_label, business_types: m.business_types, countries: m.countries, sort_order: m.sort_order });
    setAssignSearch('');
    setDialogOpen(true);
  };

  const toggleArrayItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];

  // Filter search results for assignments
  const assignedUserIds = assignments.filter(a => a.target_type === 'user').map(a => a.target_id);
  const assignedBizIds = assignments.filter(a => a.target_type === 'business').map(a => a.target_id);

  const filteredUsers = allProfiles.filter(p =>
    !assignedUserIds.includes(p.user_id) &&
    (assignSearch === '' || p.full_name.toLowerCase().includes(assignSearch.toLowerCase()) || p.email.toLowerCase().includes(assignSearch.toLowerCase()))
  );

  const filteredBusinesses = allBusinesses.filter(b =>
    !assignedBizIds.includes(b.id) &&
    (assignSearch === '' || b.name.toLowerCase().includes(assignSearch.toLowerCase()))
  );



  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Módulos disponibles en la plataforma. Arrastra para reordenar.</p>
        <Button size="sm" onClick={openCreate}><Plus className="h-3.5 w-3.5 mr-1.5" />Nuevo módulo</Button>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-[11px] uppercase tracking-wide w-8"></TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Módulo</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Sidebar</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">Tipos</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide">País</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide text-center">Activo</TableHead>
                  <TableHead className="text-[11px] uppercase tracking-wide w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <SortableContext
                items={modules.map(m => m.id)}
                strategy={verticalListSortingStrategy}
              >
                <TableBody>
                  {modules.map(m => (
                    <SortableModuleRow
                      key={m.id}
                      module={m}
                      onEdit={() => openEdit(m)}
                      onToggle={(is_active) => toggleMutation.mutate({ id: m.id, is_active })}
                    />
                  ))}
                  {modules.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No hay módulos creados.</TableCell></TableRow>
                  )}
                </TableBody>
              </SortableContext>
            </Table>
          </DndContext>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar módulo' : 'Nuevo módulo'}</DialogTitle>
            <DialogDescription>Configura los detalles del módulo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Inventario" />
            </div>
            <div className="space-y-1.5">
              <IconSelector value={form.icon} onChange={(icon) => setForm(f => ({ ...f, icon }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre en sidebar</Label>
              <Input value={form.sidebar_label} onChange={e => setForm(f => ({ ...f, sidebar_label: e.target.value }))} placeholder="Inventario" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Descripción</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Tipos de negocio</Label>
              <div className="flex flex-wrap gap-3 pt-1">
                {BUSINESS_TYPES.map(bt => (
                  <label key={bt.value} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={form.business_types.includes(bt.value)}
                      onCheckedChange={() => setForm(f => ({ ...f, business_types: toggleArrayItem(f.business_types, bt.value) }))}
                    />
                    {bt.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">País (vacío = global)</Label>
              <div className="flex flex-wrap gap-3 pt-1">
                {COUNTRIES.map(c => (
                  <label key={c.value} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={form.countries.includes(c.value)}
                      onCheckedChange={() => setForm(f => ({ ...f, countries: toggleArrayItem(f.countries, c.value) }))}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>

            {/* ─── Asignaciones a usuarios / negocios ─── */}
            {editing && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Asignar a usuarios o negocios específicos</Label>
                  <p className="text-[11px] text-muted-foreground -mt-1">Si no se asigna a nadie, el módulo estará disponible para todos según su configuración global.</p>

                  {/* Tabs user / business */}
                  <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                    <button
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${assignTab === 'user' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      onClick={() => { setAssignTab('user'); setAssignSearch(''); }}
                    >
                      <Users className="h-3.5 w-3.5" /> Usuarios
                    </button>
                    <button
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${assignTab === 'business' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                      onClick={() => { setAssignTab('business'); setAssignSearch(''); }}
                    >
                      <Store className="h-3.5 w-3.5" /> Negocios
                    </button>
                  </div>

                  {/* Current assignments */}
                  {assignments.filter(a => a.target_type === assignTab).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {assignments.filter(a => a.target_type === assignTab).map(a => {
                        const label = assignTab === 'user'
                          ? allProfiles.find(p => p.user_id === a.target_id)?.full_name || a.target_id.slice(0, 8)
                          : allBusinesses.find(b => b.id === a.target_id)?.name || a.target_id.slice(0, 8);
                        return (
                          <Badge key={a.id} variant="secondary" className="text-xs gap-1 pr-1">
                            {label}
                            <button
                              className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5"
                              onClick={() => removeAssignment.mutate(a.id)}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}

                  {/* Search + add */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      value={assignSearch}
                      onChange={e => setAssignSearch(e.target.value)}
                      placeholder={assignTab === 'user' ? 'Buscar usuario por nombre o email...' : 'Buscar negocio por nombre...'}
                      className="pl-8 h-9 text-sm"
                    />
                  </div>

                  {assignSearch.trim().length > 0 && (
                    <ScrollArea className="max-h-36 border rounded-md">
                      <div className="p-1">
                        {assignTab === 'user' ? (
                          filteredUsers.length === 0
                            ? <p className="text-xs text-muted-foreground text-center py-3">Sin resultados</p>
                            : filteredUsers.slice(0, 20).map(p => (
                              <button
                                key={p.user_id}
                                className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left"
                                onClick={() => addAssignment.mutate({ target_type: 'user', target_id: p.user_id })}
                              >
                                <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{p.full_name}</p>
                                  <p className="text-[11px] text-muted-foreground truncate">{p.email}</p>
                                </div>
                              </button>
                            ))
                        ) : (
                          filteredBusinesses.length === 0
                            ? <p className="text-xs text-muted-foreground text-center py-3">Sin resultados</p>
                            : filteredBusinesses.slice(0, 20).map(b => (
                              <button
                                key={b.id}
                                className="w-full flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent text-left"
                                onClick={() => addAssignment.mutate({ target_type: 'business', target_id: b.id })}
                              >
                                <Store className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <p className="text-sm font-medium truncate">{b.name}</p>
                              </button>
                            ))
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || !form.sidebar_label.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Plugins Tab ─────────────────────────────────────────────────────
const PluginsTab = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PlatformPlugin | null>(null);
  const [form, setForm] = useState({ name: '', description: '', module_ids: [] as string[], countries: [] as string[] });

  const { data: modules = [] } = useQuery({
    queryKey: ['platform-modules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('platform_modules').select('*').order('sort_order');
      if (error) throw error;
      return (data || []) as PlatformModule[];
    },
  });

  const { data: plugins = [], isLoading } = useQuery({
    queryKey: ['platform-plugins'],
    queryFn: async () => {
      const { data, error } = await supabase.from('platform_plugins').select('*').order('sort_order');
      if (error) throw error;
      return (data || []) as PlatformPlugin[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        module_ids: form.module_ids,
        countries: form.countries,
      };
      if (editing) {
        const { error } = await supabase.from('platform_plugins').update(payload as any).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('platform_plugins').insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-plugins'] });
      toast({ title: editing ? 'Plugin actualizado' : 'Plugin creado' });
      setDialogOpen(false);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('platform_plugins').update({ is_active } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-plugins'] }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', module_ids: [], countries: [] });
    setDialogOpen(true);
  };

  const openEdit = (p: PlatformPlugin) => {
    setEditing(p);
    setForm({ name: p.name, description: p.description || '', module_ids: p.module_ids, countries: p.countries });
    setDialogOpen(true);
  };

  const toggleArrayItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Plugins disponibles en la plataforma.</p>
        <Button size="sm" onClick={openCreate}><Plus className="h-3.5 w-3.5 mr-1.5" />Nuevo plugin</Button>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-[11px] uppercase tracking-wide">Plugin</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wide">Módulos</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wide">País</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wide text-center">Activo</TableHead>
                <TableHead className="text-[11px] uppercase tracking-wide w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plugins.map(p => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      {p.description && <p className="text-[11px] text-muted-foreground line-clamp-1">{p.description}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {p.module_ids.length === 0
                        ? <span className="text-[11px] text-muted-foreground">Ninguno</span>
                        : p.module_ids.map(mid => {
                            const mod = modules.find(m => m.id === mid);
                            return <Badge key={mid} variant="secondary" className="text-[10px]">{mod?.name || 'Desconocido'}</Badge>;
                          })
                      }
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.countries.length === 0
                      ? <span className="text-[11px] text-muted-foreground">Global</span>
                      : p.countries.map(c => <Badge key={c} variant="secondary" className="text-[10px] mr-1">{COUNTRIES.find(cc => cc.value === c)?.label || c}</Badge>)
                    }
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch checked={p.is_active} onCheckedChange={v => toggleMutation.mutate({ id: p.id, is_active: v })} />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {plugins.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">No hay plugins creados.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar plugin' : 'Nuevo plugin'}</DialogTitle>
            <DialogDescription>Configura los detalles del plugin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Tasa de Cambio" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Descripción</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Módulos afectados</Label>
              <div className="flex flex-wrap gap-3 pt-1">
                {modules.map(m => (
                  <label key={m.id} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={form.module_ids.includes(m.id)}
                      onCheckedChange={() => setForm(f => ({ ...f, module_ids: toggleArrayItem(f.module_ids, m.id) }))}
                    />
                    {m.name}
                  </label>
                ))}
                {modules.length === 0 && <span className="text-[11px] text-muted-foreground">Crea módulos primero.</span>}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">País (vacío = global)</Label>
              <div className="flex flex-wrap gap-3 pt-1">
                {COUNTRIES.map(c => (
                  <label key={c.value} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={form.countries.includes(c.value)}
                      onCheckedChange={() => setForm(f => ({ ...f, countries: toggleArrayItem(f.countries, c.value) }))}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Precios Tab ─────────────────────────────────────────────────────
const PricingTab = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [offerForm, setOfferForm] = useState({ name: '', description: '', discount_percent: 10, expires_at: '', entity_type: 'module' as string, entity_id: '' });

  const { data: modules = [] } = useQuery({
    queryKey: ['platform-modules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('platform_modules').select('*').order('sort_order');
      if (error) throw error;
      return (data || []) as PlatformModule[];
    },
  });

  const { data: plugins = [] } = useQuery({
    queryKey: ['platform-plugins'],
    queryFn: async () => {
      const { data, error } = await supabase.from('platform_plugins').select('*').order('sort_order');
      if (error) throw error;
      return (data || []) as PlatformPlugin[];
    },
  });

  const { data: pricing = [], isLoading } = useQuery({
    queryKey: ['module-plugin-pricing'],
    queryFn: async () => {
      const { data, error } = await supabase.from('module_plugin_pricing').select('*');
      if (error) throw error;
      return (data || []) as ModulePluginPricing[];
    },
  });

  const { data: offers = [] } = useQuery({
    queryKey: ['pricing-offers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pricing_offers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PricingOffer[];
    },
  });

  const upsertPricingMutation = useMutation({
    mutationFn: async (row: { entity_type: string; entity_id: string; plan_type: string; availability: string; monthly_price: number }) => {
      const { error } = await supabase.from('module_plugin_pricing').upsert(
        {
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          plan_type: row.plan_type,
          availability: row.availability,
          monthly_price: row.monthly_price,
        } as any,
        { onConflict: 'entity_id,plan_type' }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['module-plugin-pricing'] });
      toast({ title: 'Precio actualizado' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const saveOfferMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('pricing_offers').insert({
        name: offerForm.name,
        description: offerForm.description || null,
        discount_percent: offerForm.discount_percent,
        expires_at: offerForm.expires_at || null,
        entity_type: offerForm.entity_type,
        entity_id: offerForm.entity_id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pricing-offers'] });
      toast({ title: 'Oferta creada' });
      setOfferDialogOpen(false);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleOfferMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('pricing_offers').update({ is_active } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pricing-offers'] }),
  });

  const allEntities = [
    ...modules.map(m => ({ ...m, entity_type: 'module' as const })),
    ...plugins.map(p => ({ ...p, entity_type: 'plugin' as const })),
  ];

  const getPricing = (entityId: string, planType: string) =>
    pricing.find(p => p.entity_id === entityId && p.plan_type === planType);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {/* Pricing matrix */}
      <div>
        <p className="text-sm text-muted-foreground mb-4">Configura disponibilidad y precio por plan para cada módulo y plugin.</p>
        {allEntities.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Crea módulos o plugins primero para configurar precios.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {allEntities.map(entity => (
              <Card key={entity.id} className="border-border/60">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    {entity.entity_type === 'module' ? <Package className="h-3.5 w-3.5" /> : <Puzzle className="h-3.5 w-3.5" />}
                    {entity.name}
                    <Badge variant="outline" className="text-[10px] ml-auto">{entity.entity_type === 'module' ? 'Módulo' : 'Plugin'}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 pt-0">
                  <div className="grid gap-3 sm:grid-cols-3">
                    {PLAN_TYPES.map(plan => {
                      const p = getPricing(entity.id, plan.value);
                      const currentAvail = p?.availability || 'unavailable';
                      const currentPrice = p?.monthly_price || 0;
                      return (
                        <div key={plan.value} className="rounded-lg border p-3 space-y-2">
                          <p className="text-xs font-medium">{plan.label}</p>
                          <Select
                            value={currentAvail}
                            onValueChange={v => upsertPricingMutation.mutate({
                              entity_type: entity.entity_type,
                              entity_id: entity.id,
                              plan_type: plan.value,
                              availability: v,
                              monthly_price: v === 'paid_addon' ? currentPrice : 0,
                            })}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {AVAILABILITY_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs">{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {currentAvail === 'paid_addon' && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-muted-foreground">$</span>
                              <Input
                                type="number"
                                className="h-7 text-xs w-20"
                                defaultValue={currentPrice}
                                onBlur={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  if (val !== currentPrice) {
                                    upsertPricingMutation.mutate({
                                      entity_type: entity.entity_type,
                                      entity_id: entity.id,
                                      plan_type: plan.value,
                                      availability: 'paid_addon',
                                      monthly_price: val,
                                    });
                                  }
                                }}
                              />
                              <span className="text-xs text-muted-foreground">/mes</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Offers section */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="text-sm font-medium">Ofertas y descuentos</h3>
            <p className="text-[11px] text-muted-foreground">Presets de ofertas con descuento y vencimiento.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => {
            setOfferForm({ name: '', description: '', discount_percent: 10, expires_at: '', entity_type: 'module', entity_id: allEntities[0]?.id || '' });
            setOfferDialogOpen(true);
          }} disabled={allEntities.length === 0}>
            <Tag className="h-3.5 w-3.5 mr-1.5" />Nueva oferta
          </Button>
        </div>

        {offers.length > 0 && (
          <Card className="border-border/60">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-[11px] uppercase tracking-wide">Oferta</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide">Aplica a</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide">Descuento</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide">Vence</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide text-center">Activa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offers.map(o => {
                    const ent = allEntities.find(e => e.id === o.entity_id);
                    return (
                      <TableRow key={o.id}>
                        <TableCell>
                          <p className="text-sm font-medium">{o.name}</p>
                          {o.description && <p className="text-[11px] text-muted-foreground">{o.description}</p>}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">{ent?.name || 'Desconocido'}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{o.discount_percent}%</TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {o.expires_at ? format(new Date(o.expires_at), 'dd/MM/yyyy') : 'Sin vencimiento'}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={o.is_active} onCheckedChange={v => toggleOfferMutation.mutate({ id: o.id, is_active: v })} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={offerDialogOpen} onOpenChange={setOfferDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva oferta</DialogTitle>
            <DialogDescription>Configura un descuento para un módulo o plugin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre</Label>
              <Input value={offerForm.name} onChange={e => setOfferForm(f => ({ ...f, name: e.target.value }))} placeholder="Promo lanzamiento" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Descripción</Label>
              <Textarea value={offerForm.description} onChange={e => setOfferForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Aplica a</Label>
              <Select value={offerForm.entity_id} onValueChange={v => {
                const ent = allEntities.find(e => e.id === v);
                setOfferForm(f => ({ ...f, entity_id: v, entity_type: ent?.entity_type || 'module' }));
              }}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                <SelectContent>
                  {allEntities.map(e => (
                    <SelectItem key={e.id} value={e.id} className="text-sm">
                      {e.entity_type === 'module' ? '📦' : '🧩'} {e.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Descuento (%)</Label>
                <Input type="number" value={offerForm.discount_percent} onChange={e => setOfferForm(f => ({ ...f, discount_percent: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Vencimiento</Label>
                <Input type="date" value={offerForm.expires_at} onChange={e => setOfferForm(f => ({ ...f, expires_at: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfferDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveOfferMutation.mutate()} disabled={!offerForm.name.trim() || !offerForm.entity_id || saveOfferMutation.isPending}>
              {saveOfferMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Crear oferta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Business Types Tab ──────────────────────────────────────────────

const BusinessTypesTab = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessTypeConfig | null>(null);
  const [form, setForm] = useState({
    key: '', name: '', description: '', icon: 'Store', country: '' as string,
    module_ids: [] as string[], config: {} as Record<string, any>,
  });

  const { data: modules = [] } = useQuery({
    queryKey: ['platform-modules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('platform_modules').select('*').order('sort_order');
      if (error) throw error;
      return (data || []) as PlatformModule[];
    },
  });

  const { data: businessTypes = [], isLoading } = useQuery({
    queryKey: ['business-type-configs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('business_type_configs').select('*').order('sort_order');
      if (error) throw error;
      return (data || []) as BusinessTypeConfig[];
    },
  });

  const { data: printCategories = [] } = useQuery({
    queryKey: ['print-categories-defaults'],
    queryFn: async () => {
      const { data, error } = await supabase.from('print_categories').select('*').is('business_id', null).order('sort_order');
      if (error) throw error;
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        key: form.key,
        name: form.name,
        icon: form.icon,
        description: form.description || null,
        country: form.country || null,
        module_ids: form.module_ids,
        config: form.config,
      };
      if (editing) {
        const { error } = await supabase.from('business_type_configs').update(payload as any).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('business_type_configs').insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['business-type-configs'] });
      toast({ title: editing ? 'Tipo actualizado' : 'Tipo creado' });
      setDialogOpen(false);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('business_type_configs').update({ is_active } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-type-configs'] }),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ key: '', name: '', description: '', icon: 'Store', country: '', module_ids: [], config: {} });
    setDialogOpen(true);
  };

  const openEdit = (bt: BusinessTypeConfig) => {
    setEditing(bt);
    setForm({
      key: bt.key, name: bt.name, description: bt.description || '', icon: bt.icon,
      country: bt.country || '', module_ids: bt.module_ids, config: bt.config || {},
    });
    setDialogOpen(true);
  };

  const toggleArrayItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item];

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Define los tipos de negocio disponibles y qué módulos incluye cada uno.</p>
        <Button size="sm" onClick={openCreate}><Plus className="h-3.5 w-3.5 mr-1.5" />Nuevo tipo</Button>
      </div>

      {/* Business Types List */}
      <div className="space-y-4">
        {businessTypes.map(bt => (
          <Card key={bt.id} className="border-border/60">
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {bt.name}
                {bt.country && <Badge variant="secondary" className="text-[10px]">{COUNTRIES.find(c => c.value === bt.country)?.label || bt.country}</Badge>}
                <div className="ml-auto flex items-center gap-2">
                  <Switch checked={bt.is_active} onCheckedChange={v => toggleMutation.mutate({ id: bt.id, is_active: v })} />
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(bt)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-0 space-y-3">
              {bt.description && <p className="text-xs text-muted-foreground">{bt.description}</p>}
              
              <div>
                <p className="text-[11px] font-medium text-muted-foreground mb-1">Módulos asignados</p>
                <div className="flex gap-1 flex-wrap">
                  {bt.module_ids.length === 0
                    ? <span className="text-[11px] text-muted-foreground italic">Ninguno asignado</span>
                    : bt.module_ids.map(mid => {
                        const mod = modules.find(m => m.id === mid);
                        return <Badge key={mid} variant="outline" className="text-[10px]">{mod?.name || 'Desconocido'}</Badge>;
                      })
                  }
                </div>
              </div>

              {/* Copy Shop specific info */}
              {bt.key === 'copy_shop' && (
                <div className="rounded-lg border border-border/60 p-3 space-y-2 bg-muted/30">
                  <p className="text-xs font-medium">Configuración Punto de Copias</p>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground font-medium">Modos de operación:</p>
                    {COPY_SHOP_MODES.map(m => (
                      <div key={m.value} className="flex items-start gap-2 text-[11px]">
                        <Badge variant="secondary" className="text-[9px] mt-0.5 shrink-0">Modo {m.value}</Badge>
                        <span className="text-muted-foreground">{m.label} — {m.desc}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground font-medium">Puestos de empleados:</p>
                    <div className="flex gap-1">
                      {EMPLOYEE_STATIONS.map(s => (
                        <Badge key={s.value} variant="outline" className="text-[10px]">{s.label}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground font-medium">Categorías base de Impresiones:</p>
                    <div className="flex gap-1 flex-wrap">
                      {printCategories.map((pc: any) => (
                        <Badge key={pc.id} variant="secondary" className="text-[10px]">{pc.name}</Badge>
                      ))}
                      {printCategories.length === 0 && DEFAULT_PRINT_CATEGORIES.map(c => (
                        <Badge key={c} variant="secondary" className="text-[10px]">{c}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {businessTypes.length === 0 && (
          <Card className="border-border/60">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No hay tipos de negocio configurados.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar tipo de negocio' : 'Nuevo tipo de negocio'}</DialogTitle>
            <DialogDescription>Define qué módulos ve el dueño en su sidebar.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm">Clave (key)</Label>
                <Input value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} placeholder="store" disabled={!!editing} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Ícono (Lucide)</Label>
                <Input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} placeholder="Store" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Tienda" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Descripción</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">País exclusivo (vacío = global)</Label>
              <Select value={form.country} onValueChange={v => setForm(f => ({ ...f, country: v === '_none' ? '' : v }))}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Global" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none" className="text-sm">Global (todos)</SelectItem>
                  {COUNTRIES.map(c => (
                    <SelectItem key={c.value} value={c.value} className="text-sm">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Módulos incluidos</Label>
              <div className="flex flex-wrap gap-3 pt-1">
                {modules.map(m => (
                  <label key={m.id} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={form.module_ids.includes(m.id)}
                      onCheckedChange={() => setForm(f => ({ ...f, module_ids: toggleArrayItem(f.module_ids, m.id) }))}
                    />
                    {m.name}
                  </label>
                ))}
                {modules.length === 0 && <span className="text-[11px] text-muted-foreground">Crea módulos primero.</span>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.key.trim() || !form.name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────
const AdminModules = () => {
  return (
    <AppLayout title="Módulos y Plugins">
      <Tabs defaultValue="modules" className="space-y-6">
        <TabsList className="bg-muted/60">
          <TabsTrigger value="modules" className="gap-1.5 text-xs">
            <Package className="h-3.5 w-3.5" /> Módulos
          </TabsTrigger>
          <TabsTrigger value="plugins" className="gap-1.5 text-xs">
            <Puzzle className="h-3.5 w-3.5" /> Plugins
          </TabsTrigger>
          <TabsTrigger value="pricing" className="gap-1.5 text-xs">
            <DollarSign className="h-3.5 w-3.5" /> Precios
          </TabsTrigger>
          <TabsTrigger value="business-types" className="gap-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5" /> Tipos de Negocio
          </TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="mt-0">
          <ModulesTab />
        </TabsContent>
        <TabsContent value="plugins" className="mt-0">
          <PluginsTab />
        </TabsContent>
        <TabsContent value="pricing" className="mt-0">
          <PricingTab />
        </TabsContent>
        <TabsContent value="business-types" className="mt-0">
          <BusinessTypesTab />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
};

export default AdminModules;
