import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus, Loader2, Pencil, PackagePlus, Trash2 } from 'lucide-react';
import { getIconComponent } from '@/components/services/IconSelector';
import IconSelector from '@/components/services/IconSelector';
import { getAllUnits } from '@/lib/unitConversion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const AREA_COLORS = [
  { value: 'blue', label: 'Azul', class: 'bg-blue-500' },
  { value: 'green', label: 'Verde', class: 'bg-green-500' },
  { value: 'orange', label: 'Naranja', class: 'bg-orange-500' },
  { value: 'purple', label: 'Morado', class: 'bg-purple-500' },
  { value: 'pink', label: 'Rosa', class: 'bg-pink-500' },
  { value: 'red', label: 'Rojo', class: 'bg-red-500' },
  { value: 'yellow', label: 'Amarillo', class: 'bg-yellow-500' },
  { value: 'teal', label: 'Teal', class: 'bg-teal-500' },
];

const getAreaColorClass = (color: string | null) => {
  return AREA_COLORS.find(c => c.value === color)?.class || 'bg-muted-foreground';
};

const InsumosInventoryTab = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const businessId = profile?.business_id;

  const [selectedArea, setSelectedArea] = useState<any>(null);
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<any>(null);
  const [areaForm, setAreaForm] = useState({ name: '', icon: 'Package', color: 'blue' });

  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<any>(null);
  const [matForm, setMatForm] = useState({
    name: '', unit_purchase: '',
  });

  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [entryForm, setEntryForm] = useState({ material_id: '', cantidad: 0, costo_unitario: 0, nota: '' });

  const [deletingArea, setDeletingArea] = useState<any>(null);

  // ─── Queries ───
  const { data: areas = [], isLoading: areasLoading } = useQuery({
    queryKey: ['insumo-areas', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('insumo_areas')
        .select('*')
        .eq('business_id', businessId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
  });

  const { data: materials = [], isLoading: materialsLoading } = useQuery({
    queryKey: ['insumo-materials', businessId, selectedArea?.id],
    queryFn: async () => {
      if (!businessId || !selectedArea?.id) return [];
      const { data, error } = await supabase
        .from('raw_materials')
        .select('*')
        .eq('business_id', businessId)
        .eq('area_id', selectedArea.id)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId && !!selectedArea?.id,
  });

  // ─── Area mutations ───
  const saveArea = useMutation({
    mutationFn: async (form: typeof areaForm & { id?: string }) => {
      if (!businessId) throw new Error('No business');
      if (form.id) {
        const { error } = await supabase.from('insumo_areas').update({
          name: form.name, icon: form.icon, color: form.color,
        }).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('insumo_areas').insert({
          business_id: businessId, name: form.name, icon: form.icon, color: form.color,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumo-areas'] });
      setAreaDialogOpen(false);
      setEditingArea(null);
      toast({ title: 'Área guardada' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteArea = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('insumo_areas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumo-areas'] });
      setDeletingArea(null);
      toast({ title: 'Área eliminada' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ─── Material mutations ───
  const saveMaterial = useMutation({
    mutationFn: async (form: typeof matForm & { id?: string }) => {
      if (!businessId || !selectedArea?.id) throw new Error('No context');
      const payload = {
        name: form.name,
        unit_purchase: form.unit_purchase || null,
      };
      if (form.id) {
        const { error } = await supabase.from('raw_materials').update(payload).eq('id', form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('raw_materials').insert({
          ...payload, business_id: businessId, area_id: selectedArea.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumo-materials'] });
      setMaterialDialogOpen(false);
      setEditingMaterial(null);
      toast({ title: 'Insumo guardado' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const createEntry = useMutation({
    mutationFn: async (form: typeof entryForm) => {
      if (!businessId || !profile?.user_id) throw new Error('No context');
      const { error } = await supabase.from('raw_material_entries').insert({
        business_id: businessId,
        material_id: form.material_id,
        cantidad: form.cantidad,
        costo_unitario: form.costo_unitario,
        nota: form.nota || null,
        user_id: profile.user_id,
      });
      if (error) throw error;
      // Update stock directly
      const mat = materials.find(m => m.id === form.material_id);
      if (mat) {
        await supabase.from('raw_materials')
          .update({ stock_almacen: mat.stock_almacen + form.cantidad })
          .eq('id', form.material_id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumo-materials'] });
      setEntryDialogOpen(false);
      setEntryForm({ material_id: '', cantidad: 0, costo_unitario: 0, nota: '' });
      toast({ title: 'Entrada registrada' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const openNewArea = () => {
    setEditingArea(null);
    setAreaForm({ name: '', icon: 'Package', color: 'blue' });
    setAreaDialogOpen(true);
  };

  const openEditArea = (area: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingArea(area);
    setAreaForm({ name: area.name, icon: area.icon || 'Package', color: area.color || 'blue' });
    setAreaDialogOpen(true);
  };

  const openNewMaterial = () => {
    setEditingMaterial(null);
    setMatForm({ name: '', unit_purchase: '' });
    setMaterialDialogOpen(true);
  };

  const openEditMaterial = (mat: any) => {
    setEditingMaterial(mat);
    setMatForm({
      name: mat.name,
      unit_purchase: mat.unit_purchase || '',
    });
    setMaterialDialogOpen(true);
  };

  const allUnits = getAllUnits();

  if (areasLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  // ─── Level 2: Materials in area ───
  if (selectedArea) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedArea(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {(() => { const Icon = getIconComponent(selectedArea.icon); return <Icon className="h-5 w-5 shrink-0" />; })()}
            <h2 className="text-lg font-semibold truncate">{selectedArea.name}</h2>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEntryDialogOpen(true)}>
            <PackagePlus className="h-4 w-4 mr-1" />Entrada
          </Button>
          <Button size="sm" onClick={openNewMaterial}>
            <Plus className="h-4 w-4 mr-1" />Insumo
          </Button>
        </div>

        {materialsLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : materials.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">Sin insumos en esta área</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={openNewMaterial}>
              <Plus className="h-4 w-4 mr-1" />Crear primer insumo
            </Button>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-center text-xs">U. Compra</TableHead>
                  <TableHead className="text-center text-xs">U. Uso</TableHead>
                  <TableHead className="text-right text-xs">Factor</TableHead>
                  <TableHead className="text-right">Costo</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materials.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{m.stock_almacen}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">{m.unit_purchase || '—'}</TableCell>
                    <TableCell className="text-center text-xs text-muted-foreground">{m.unit_use || '—'}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{m.conversion_factor || '—'}</TableCell>
                    <TableCell className="text-right">${m.costo_unitario}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditMaterial(m)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* New/Edit Material Dialog */}
        <Dialog open={materialDialogOpen} onOpenChange={(o) => { setMaterialDialogOpen(o); if (!o) setEditingMaterial(null); }}>
          <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle>{editingMaterial ? 'Editar insumo' : 'Nuevo insumo'}</DialogTitle></DialogHeader>
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              <div>
                <Label>Nombre</Label>
                <Input value={matForm.name} onChange={e => setMatForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Harina de trigo" />
              </div>
              <div>
                <Label>Unidad de compra</Label>
                <Select value={matForm.unit_purchase} onValueChange={v => setMatForm(f => ({ ...f, unit_purchase: v }))}>
                  <SelectTrigger><SelectValue placeholder="Ej: kg, litro, caja" /></SelectTrigger>
                  <SelectContent>
                    {allUnits.map(u => (
                      <SelectItem key={u.value} value={u.value}>{u.label} ({u.category})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMaterialDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => saveMaterial.mutate(editingMaterial ? { ...matForm, id: editingMaterial.id } : matForm)}
                disabled={!matForm.name.trim() || saveMaterial.isPending}
              >
                {saveMaterial.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Guardar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Entry Dialog */}
        <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
          <DialogContent className="max-w-sm max-h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle>Registrar entrada</DialogTitle></DialogHeader>
            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              <div>
                <Label>Insumo</Label>
                <Select value={entryForm.material_id} onValueChange={v => setEntryForm(f => ({ ...f, material_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                  <SelectContent>
                    {materials.map((m: any) => (
                      <SelectItem key={m.id} value={m.id}>{m.name} (Stock: {m.stock_almacen})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Cantidad</Label>
                  <Input type="number" min={1} value={entryForm.cantidad || ''} onChange={e => setEntryForm(f => ({ ...f, cantidad: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <Label>Costo unitario</Label>
                  <Input type="number" min={0} step="0.01" value={entryForm.costo_unitario || ''} onChange={e => setEntryForm(f => ({ ...f, costo_unitario: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <div>
                <Label>Nota (opcional)</Label>
                <Textarea value={entryForm.nota} onChange={e => setEntryForm(f => ({ ...f, nota: e.target.value }))} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEntryDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => createEntry.mutate(entryForm)}
                disabled={!entryForm.material_id || !entryForm.cantidad || createEntry.isPending}
              >
                {createEntry.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Registrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── Level 1: Areas ───
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Áreas de insumos</h2>
        <Button size="sm" onClick={openNewArea}>
          <Plus className="h-4 w-4 mr-1" />Nueva área
        </Button>
      </div>

      {areas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Crea áreas para organizar tus insumos</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={openNewArea}>
            <Plus className="h-4 w-4 mr-1" />Crear primera área
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {areas.map((area: any) => {
            const Icon = getIconComponent(area.icon);
            return (
              <button
                key={area.id}
                onClick={() => setSelectedArea(area)}
                className="group relative rounded-xl border bg-card p-4 text-left transition-all hover:shadow-md hover:border-primary/30"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`rounded-lg p-2 ${getAreaColorClass(area.color)} text-white`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      className="rounded p-1 hover:bg-muted"
                      onClick={(e) => openEditArea(area, e)}
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      className="rounded p-1 hover:bg-destructive/10"
                      onClick={(e) => { e.stopPropagation(); setDeletingArea(area); }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
                <p className="font-medium text-sm truncate">{area.name}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Area Dialog */}
      <Dialog open={areaDialogOpen} onOpenChange={(o) => { setAreaDialogOpen(o); if (!o) setEditingArea(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>{editingArea ? 'Editar área' : 'Nueva área'}</DialogTitle></DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            <div>
              <Label>Nombre</Label>
              <Input value={areaForm.name} onChange={e => setAreaForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Cocina, Limpieza" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Color</Label>
              <div className="flex gap-2 flex-wrap">
                {AREA_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setAreaForm(f => ({ ...f, color: c.value }))}
                    className={`h-8 w-8 rounded-full transition-all ${c.class} ${
                      areaForm.color === c.value ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-70 hover:opacity-100'
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
            <IconSelector value={areaForm.icon} onChange={(icon) => setAreaForm(f => ({ ...f, icon }))} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAreaDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => saveArea.mutate(editingArea ? { ...areaForm, id: editingArea.id } : areaForm)}
              disabled={!areaForm.name.trim() || saveArea.isPending}
            >
              {saveArea.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete area confirm */}
      <AlertDialog open={!!deletingArea} onOpenChange={(o) => { if (!o) setDeletingArea(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar área "{deletingArea?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminarán también los insumos asociados a esta área. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingArea && deleteArea.mutate(deletingArea.id)}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default InsumosInventoryTab;
