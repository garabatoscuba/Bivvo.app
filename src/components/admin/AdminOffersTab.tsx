import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, Pencil, Trash2, Loader2, Tag, Percent, DollarSign, Users, Globe, Search,
  ArrowUp, ArrowDown, ArrowUpDown,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface PlanOffer {
  id: string; name: string; description: string | null;
  discount_type: 'percentage' | 'fixed'; discount_value: number;
  applies_to_plans: string[]; target_type: 'all' | 'specific';
  target_user_ids: string[]; starts_at: string; expires_at: string | null;
  is_active: boolean; created_at: string;
}

type SortDir = 'asc' | 'desc';

const EMPTY_FORM: {
  name: string; description: string; discount_type: 'percentage' | 'fixed';
  discount_value: number; applies_to_plans: string[];
  target_type: 'all' | 'specific'; target_user_ids: string;
  starts_at: string; expires_at: string; is_active: boolean;
} = {
  name: '', description: '', discount_type: 'percentage',
  discount_value: 0, applies_to_plans: ['basic', 'professional'],
  target_type: 'all', target_user_ids: '',
  starts_at: new Date().toISOString().slice(0, 16), expires_at: '', is_active: true,
};

const SortHead = ({ label, sortKey: sk, currentKey, currentDir, onToggle, className }: {
  label: string; sortKey: string; currentKey: string; currentDir: SortDir;
  onToggle: (k: any) => void; className?: string;
}) => (
  <TableHead className={`cursor-pointer select-none hover:text-foreground text-[11px] uppercase tracking-wide ${className || ''}`} onClick={() => onToggle(sk)}>
    <span className="inline-flex items-center gap-1">
      {label}
      {currentKey === sk ? (currentDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-30" />}
    </span>
  </TableHead>
);

const AdminOffersTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<PlanOffer | null>(null);
  const [userSearch, setUserSearch] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const toggleSort = useCallback((k: string) => {
    setSortKey(prev => { if (prev === k) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); return k; } setSortDir('desc'); return k; });
  }, []);

  const { data: offers, isLoading } = useQuery({
    queryKey: ['admin-plan-offers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('plan_offers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PlanOffer[];
    },
  });

  const { data: allProfiles } = useQuery({
    queryKey: ['admin-profiles-for-offers'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email, user_id').order('full_name');
      return data || [];
    },
  });

  // Mutations
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name, description: form.description || null,
        discount_type: form.discount_type, discount_value: form.discount_value,
        applies_to_plans: form.applies_to_plans, target_type: form.target_type,
        target_user_ids: form.target_type === 'specific' ? form.target_user_ids.split(',').map(s => s.trim()).filter(Boolean) : [],
        starts_at: new Date(form.starts_at).toISOString(),
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        is_active: form.is_active,
      };
      if (editingId) { const { error } = await supabase.from('plan_offers').update(payload).eq('id', editingId); if (error) throw error; }
      else { const { error } = await supabase.from('plan_offers').insert(payload); if (error) throw error; }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-plan-offers'] }); toast({ title: editingId ? 'Oferta actualizada' : 'Oferta creada' }); closeDialog(); },
    onError: (err: any) => { toast({ title: 'Error', description: err.message, variant: 'destructive' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('plan_offers').delete().eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-plan-offers'] }); toast({ title: 'Oferta eliminada' }); setDeleteTarget(null); },
    onError: (err: any) => { toast({ title: 'Error', description: err.message, variant: 'destructive' }); setDeleteTarget(null); },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => { const { error } = await supabase.from('plan_offers').update({ is_active }).eq('id', id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin-plan-offers'] }); },
  });

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setDialogOpen(true); };
  const openEdit = (offer: PlanOffer) => {
    setEditingId(offer.id);
    setForm({
      name: offer.name, description: offer.description || '', discount_type: offer.discount_type,
      discount_value: offer.discount_value, applies_to_plans: offer.applies_to_plans,
      target_type: offer.target_type, target_user_ids: offer.target_user_ids?.join(', ') || '',
      starts_at: new Date(offer.starts_at).toISOString().slice(0, 16),
      expires_at: offer.expires_at ? new Date(offer.expires_at).toISOString().slice(0, 16) : '',
      is_active: offer.is_active,
    });
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditingId(null); setForm(EMPTY_FORM); };
  const togglePlan = (plan: string) => setForm(f => ({ ...f, applies_to_plans: f.applies_to_plans.includes(plan) ? f.applies_to_plans.filter(p => p !== plan) : [...f.applies_to_plans, plan] }));

  const getOfferStatus = (offer: PlanOffer): string => {
    if (!offer.is_active) return 'inactive';
    const now = new Date();
    if (new Date(offer.starts_at) > now) return 'scheduled';
    if (offer.expires_at && new Date(offer.expires_at) < now) return 'expired';
    return 'active';
  };

  const getStatusBadge = (offer: PlanOffer) => {
    const s = getOfferStatus(offer);
    if (s === 'inactive') return <Badge variant="secondary" className="text-[10px]">Inactiva</Badge>;
    if (s === 'scheduled') return <Badge variant="outline" className="text-[10px]">Programada</Badge>;
    if (s === 'expired') return <Badge variant="destructive" className="text-[10px]">Expirada</Badge>;
    return <Badge className="text-[10px]">Activa</Badge>;
  };

  const formatDiscount = (o: PlanOffer) => o.discount_type === 'percentage' ? `${o.discount_value}%` : `$${Number(o.discount_value).toFixed(2)}`;

  // Filter + sort
  const filteredOffers = useMemo(() => {
    let list = offers || [];
    const q = search.toLowerCase().trim();
    if (q) list = list.filter(o => o.name.toLowerCase().includes(q) || (o.description || '').toLowerCase().includes(q));
    if (filterStatus !== 'all') list = list.filter(o => getOfferStatus(o) === filterStatus);
    return [...list].sort((a, b) => {
      let va: any, vb: any;
      if (sortKey === 'created_at' || sortKey === 'starts_at') { va = new Date(a[sortKey as keyof PlanOffer] as string).getTime(); vb = new Date(b[sortKey as keyof PlanOffer] as string).getTime(); }
      else if (sortKey === 'discount_value') { va = Number(a.discount_value); vb = Number(b.discount_value); }
      else { va = ((a as any)[sortKey] || '').toString().toLowerCase(); vb = ((b as any)[sortKey] || '').toString().toLowerCase(); }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [offers, search, filterStatus, sortKey, sortDir]);

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar oferta..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] h-9 text-sm"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Estado: Todos</SelectItem>
            <SelectItem value="active">Activas</SelectItem>
            <SelectItem value="inactive">Inactivas</SelectItem>
            <SelectItem value="scheduled">Programadas</SelectItem>
            <SelectItem value="expired">Expiradas</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filteredOffers.length} oferta{filteredOffers.length !== 1 ? 's' : ''}</span>
        <Button size="sm" className="gap-1.5 ml-auto" onClick={openCreate}><Plus className="h-3.5 w-3.5" /> Nueva oferta</Button>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          {filteredOffers.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <SortHead label="Oferta" sortKey="name" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
                    <SortHead label="Descuento" sortKey="discount_value" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
                    <TableHead className="text-[11px] uppercase tracking-wide">Planes</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide">Destino</TableHead>
                    <SortHead label="Vigencia" sortKey="starts_at" currentKey={sortKey} currentDir={sortDir} onToggle={toggleSort} />
                    <TableHead className="text-[11px] uppercase tracking-wide">Estado</TableHead>
                    <TableHead className="text-[11px] uppercase tracking-wide text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOffers.map(offer => (
                    <TableRow key={offer.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{offer.name}</p>
                            {offer.description && <p className="text-[11px] text-muted-foreground line-clamp-1">{offer.description}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {offer.discount_type === 'percentage' ? <Percent className="h-3 w-3 text-muted-foreground" /> : <DollarSign className="h-3 w-3 text-muted-foreground" />}
                          <span className="text-sm font-semibold">{formatDiscount(offer)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {offer.applies_to_plans.map(p => <Badge key={p} variant="outline" className="text-[10px]">{p === 'basic' ? 'Básico' : 'Pro'}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {offer.target_type === 'all'
                            ? <><Globe className="h-3 w-3 text-muted-foreground" /> <span className="text-[11px]">Todos</span></>
                            : <><Users className="h-3 w-3 text-muted-foreground" /> <span className="text-[11px]">{offer.target_user_ids?.length || 0} usuarios</span></>
                          }
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-[11px] text-muted-foreground">
                          <p>{format(new Date(offer.starts_at), "d MMM yy", { locale: es })}</p>
                          {offer.expires_at ? <p>→ {format(new Date(offer.expires_at), "d MMM yy", { locale: es })}</p> : <p className="text-[10px]">Sin vencimiento</p>}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(offer)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Switch checked={offer.is_active} onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: offer.id, is_active: checked })} className="scale-75" />
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(offer)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(offer)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">No hay ofertas creadas. Crea la primera para ofrecer descuentos.</div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-lg max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Tag className="h-4 w-4" /> {editingId ? 'Editar oferta' : 'Nueva oferta'}</DialogTitle>
            <DialogDescription>{editingId ? 'Modifica los detalles de la oferta.' : 'Configura un descuento para los planes.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Descuento de lanzamiento" />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descripción opcional" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo de descuento</Label>
                <select value={form.discount_type} onChange={(e) => setForm(f => ({ ...f, discount_type: e.target.value as any }))}
                  className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                  <option value="percentage">Porcentaje (%)</option>
                  <option value="fixed">Monto fijo ($)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Valor</Label>
                <Input type="number" min={0} max={form.discount_type === 'percentage' ? 100 : undefined} step={form.discount_type === 'percentage' ? 1 : 0.01}
                  value={form.discount_value} onChange={(e) => setForm(f => ({ ...f, discount_value: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Aplica a planes</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.applies_to_plans.includes('basic')} onCheckedChange={() => togglePlan('basic')} /> Básico</label>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={form.applies_to_plans.includes('professional')} onCheckedChange={() => togglePlan('professional')} /> Profesional</label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Destinatarios</Label>
              <select value={form.target_type} onChange={(e) => setForm(f => ({ ...f, target_type: e.target.value as any }))}
                className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                <option value="all">Todos los usuarios</option>
                <option value="specific">Usuarios específicos</option>
              </select>
            </div>
            {form.target_type === 'specific' && (
              <div className="space-y-1.5">
                <Label>Seleccionar usuarios</Label>
                <div className="relative mb-1.5">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Buscar por nombre o email..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                </div>
                <div className="rounded-md border border-input max-h-48 overflow-y-auto p-2 space-y-1">
                  {(() => {
                    const selectedIds = form.target_user_ids.split(',').map(s => s.trim()).filter(Boolean);
                    const q = userSearch.toLowerCase().trim();
                    const filtered = (allProfiles || []).filter((p: any) =>
                      !q || (p.full_name || '').toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q)
                    );
                    // Show selected first, then the rest
                    const sorted = [...filtered].sort((a: any, b: any) => {
                      const aSelected = selectedIds.includes(a.user_id) ? 0 : 1;
                      const bSelected = selectedIds.includes(b.user_id) ? 0 : 1;
                      return aSelected - bSelected;
                    });
                    if (sorted.length === 0) return <p className="text-xs text-muted-foreground py-2 text-center">No se encontraron usuarios</p>;
                    return sorted.map((p: any) => {
                      const isSelected = selectedIds.includes(p.user_id);
                      return (
                        <label key={p.id} className="flex items-center gap-2 text-sm py-1 px-1 rounded hover:bg-accent/50 cursor-pointer">
                          <Checkbox checked={isSelected} onCheckedChange={() => {
                            const ids = form.target_user_ids.split(',').map(s => s.trim()).filter(Boolean);
                            const next = isSelected ? ids.filter(id => id !== p.user_id) : [...ids, p.user_id];
                            setForm(f => ({ ...f, target_user_ids: next.join(', ') }));
                          }} />
                          <span>{p.full_name}</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">{p.email}</span>
                        </label>
                      );
                    });
                  })()}
                </div>
                {(() => {
                  const count = form.target_user_ids.split(',').map(s => s.trim()).filter(Boolean).length;
                  return count > 0 ? <p className="text-[11px] text-muted-foreground">{count} usuario{count !== 1 ? 's' : ''} seleccionado{count !== 1 ? 's' : ''}</p> : null;
                })()}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Inicio</Label>
                <Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm(f => ({ ...f, starts_at: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Vencimiento</Label>
                <Input type="datetime-local" value={form.expires_at} onChange={(e) => setForm(f => ({ ...f, expires_at: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(checked) => setForm(f => ({ ...f, is_active: checked }))} />
              <Label>{form.is_active ? 'Activa' : 'Inactiva'}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear oferta'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminOffersTab;
