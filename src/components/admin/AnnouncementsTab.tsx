import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Loader2, Megaphone, Link as LinkIcon, CalendarClock, Users } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Announcement {
  id: string;
  title: string;
  message: string;
  link_url: string | null;
  link_label: string | null;
  target_type: string;
  target_value: string | null;
  frequency_days: number;
  is_active: boolean;
  starts_at: string;
  expires_at: string | null;
  created_at: string;
}

const TARGET_TYPES = [
  { value: 'all', label: 'Todos los usuarios' },
  { value: 'plan', label: 'Por plan' },
  { value: 'role', label: 'Por rol' },
  { value: 'user', label: 'Usuario específico' },
];

const PLAN_OPTIONS = [
  { value: 'free', label: 'Gratuito' },
  { value: 'basic', label: 'Básico' },
  { value: 'professional', label: 'Profesional' },
];

const ROLE_OPTIONS = [
  { value: 'owner', label: 'Dueño' },
  { value: 'manager', label: 'Gerente' },
  { value: 'employee', label: 'Empleado' },
  { value: 'partner', label: 'Partner' },
];

const defaultForm = {
  title: '',
  message: '',
  link_url: '',
  link_label: '',
  target_type: 'all',
  target_value: '',
  frequency_days: 0,
  starts_at: '',
  expires_at: '',
};

export default function AnnouncementsTab() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['platform-announcements'],
    queryFn: async () => {
      const { data } = await supabase.from('platform_announcements').select('*').order('created_at', { ascending: false });
      return (data || []) as unknown as Announcement[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        title: form.title,
        message: form.message,
        link_url: form.link_url || null,
        link_label: form.link_label || null,
        target_type: form.target_type,
        target_value: form.target_type === 'all' ? null : form.target_value || null,
        frequency_days: form.frequency_days,
        starts_at: form.starts_at || new Date().toISOString(),
        expires_at: form.expires_at || null,
      };
      if (editing) {
        const { error } = await supabase.from('platform_announcements').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('platform_announcements').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-announcements'] });
      setDialog(false);
      toast({ title: editing ? 'Anuncio actualizado' : 'Anuncio creado' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('platform_announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-announcements'] });
      setDeleteTarget(null);
      toast({ title: 'Anuncio eliminado' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('platform_announcements').update({ is_active } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-announcements'] }),
  });

  const openNew = () => {
    setEditing(null);
    setForm(defaultForm);
    setDialog(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setForm({
      title: a.title,
      message: a.message,
      link_url: a.link_url || '',
      link_label: a.link_label || '',
      target_type: a.target_type,
      target_value: a.target_value || '',
      frequency_days: a.frequency_days,
      starts_at: a.starts_at ? a.starts_at.slice(0, 16) : '',
      expires_at: a.expires_at ? a.expires_at.slice(0, 16) : '',
    });
    setDialog(true);
  };

  const targetLabel = (a: Announcement) => {
    if (a.target_type === 'all') return 'Todos';
    if (a.target_type === 'plan') return PLAN_OPTIONS.find(p => p.value === a.target_value)?.label || a.target_value;
    if (a.target_type === 'role') return ROLE_OPTIONS.find(r => r.value === a.target_value)?.label || a.target_value;
    return 'Usuario';
  };

  const freqLabel = (days: number) => {
    if (days === 0) return 'Una vez';
    if (days === 1) return 'Diario';
    return `Cada ${days} días`;
  };

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Anuncios dirigidos que se muestran en el chat del asistente.</p>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nuevo anuncio</Button>
      </div>

      {announcements.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground"><Megaphone className="h-6 w-6 mx-auto mb-2 opacity-30" />No hay anuncios creados.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => (
            <Card key={a.id} className={`border-border/60 ${!a.is_active ? 'opacity-50' : ''}`}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold">{a.title}</h4>
                      <Badge variant="secondary" className="text-[10px]"><Users className="h-3 w-3 mr-0.5" />{targetLabel(a)}</Badge>
                      <Badge variant="outline" className="text-[10px]"><CalendarClock className="h-3 w-3 mr-0.5" />{freqLabel(a.frequency_days)}</Badge>
                      {a.link_url && <Badge variant="outline" className="text-[10px]"><LinkIcon className="h-3 w-3 mr-0.5" />{a.link_label || 'Enlace'}</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{a.message}</p>
                    <p className="text-[10px] text-muted-foreground/70">
                      Creado: {format(new Date(a.created_at), 'dd MMM yyyy', { locale: es })}
                      {a.expires_at && ` · Expira: ${format(new Date(a.expires_at), 'dd MMM yyyy', { locale: es })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch checked={a.is_active} onCheckedChange={v => toggleMutation.mutate({ id: a.id, is_active: v })} />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget(a)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar anuncio' : 'Nuevo anuncio'}</DialogTitle>
            <DialogDescription>Configura el contenido, destino y frecuencia del anuncio.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Título</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Título del anuncio" className="mt-1" /></div>
            <div><Label>Mensaje</Label><Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={3} className="mt-1" placeholder="Contenido del anuncio..." /></div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Enlace (opcional)</Label><Input value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} placeholder="https://..." className="mt-1" /></div>
              <div><Label>Texto del enlace</Label><Input value={form.link_label} onChange={e => setForm(f => ({ ...f, link_label: e.target.value }))} placeholder="Ver más" className="mt-1" /></div>
            </div>

            <div>
              <Label>Dirigido a</Label>
              <Select value={form.target_type} onValueChange={v => setForm(f => ({ ...f, target_type: v, target_value: '' }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TARGET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {form.target_type === 'plan' && (
              <div>
                <Label>Plan</Label>
                <Select value={form.target_value} onValueChange={v => setForm(f => ({ ...f, target_value: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar plan" /></SelectTrigger>
                  <SelectContent>
                    {PLAN_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.target_type === 'role' && (
              <div>
                <Label>Rol</Label>
                <Select value={form.target_value} onValueChange={v => setForm(f => ({ ...f, target_value: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {form.target_type === 'user' && (
              <div><Label>ID de usuario</Label><Input value={form.target_value} onChange={e => setForm(f => ({ ...f, target_value: e.target.value }))} placeholder="UUID del usuario" className="mt-1" /></div>
            )}

            <div>
              <Label>Frecuencia (días)</Label>
              <div className="flex items-center gap-2 mt-1">
                <Input type="number" min={0} value={form.frequency_days} onChange={e => setForm(f => ({ ...f, frequency_days: parseInt(e.target.value) || 0 }))} className="w-24" />
                <span className="text-xs text-muted-foreground">0 = se muestra una sola vez</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>Inicia</Label><Input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} className="mt-1" /></div>
              <div><Label>Expira (opcional)</Label><Input type="datetime-local" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} className="mt-1" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.title.trim() || !form.message.trim() || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Eliminar anuncio</AlertDialogTitle><AlertDialogDescription>¿Eliminar "{deleteTarget?.title}"? Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(deleteTarget!.id)}>Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
