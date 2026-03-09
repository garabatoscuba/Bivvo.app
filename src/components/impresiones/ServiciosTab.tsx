import { useState } from 'react';
import { usePrintServiceTypes, useRawMaterials, useSaveServiceType, useDeleteServiceType } from '@/hooks/usePrintData';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import IconSelector, { getIconComponent } from '@/components/services/IconSelector';

const emptyForm = {
  id: '',
  name: '',
  icon: 'Printer',
  unit_label: 'hoja',
  precio_base: 0,
  admite_doble_cara: false,
  material_id: '',
  consumo_por_unidad: 1,
  rendimiento_especial: null as any,
  is_active: true,
  vende_por_tramos: false,
  tramos_por_unidad: 1,
};

const ServiciosTab = () => {
  const { data: services = [], isLoading } = usePrintServiceTypes();
  const { data: materials = [] } = useRawMaterials();
  const saveMutation = useSaveServiceType();
  const deleteMutation = useDeleteServiceType();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [rendimientoText, setRendimientoText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const openNew = () => {
    setForm(emptyForm);
    setRendimientoText('');
    setOpen(true);
  };

  const openEdit = (s: any) => {
    setForm({
      id: s.id,
      name: s.name,
      icon: s.icon || 'Printer',
      unit_label: s.unit_label,
      precio_base: s.precio_base,
      admite_doble_cara: s.admite_doble_cara,
      material_id: s.material_id || '',
      consumo_por_unidad: s.consumo_por_unidad,
      rendimiento_especial: s.rendimiento_especial,
      is_active: s.is_active,
      vende_por_tramos: s.vende_por_tramos ?? false,
      tramos_por_unidad: s.tramos_por_unidad ?? 1,
    });
    setRendimientoText(s.rendimiento_especial ? JSON.stringify(s.rendimiento_especial) : '');
    setOpen(true);
  };

  const handleSave = () => {
    const payload = {
      ...form,
      material_id: form.material_id || null,
      rendimiento_especial: rendimientoText.trim() ? (() => { try { return JSON.parse(rendimientoText); } catch { return { nota: rendimientoText }; } })() : null,
    };
    saveMutation.mutate(payload, { onSuccess: () => setOpen(false) });
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tipos de Servicio</h2>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nuevo servicio</Button>
      </div>

      {services.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No hay servicios configurados</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s: any) => {
            const Icon = getIconComponent(s.icon);
            return (
              <Card key={s.id} className={!s.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="h-5 w-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.name}</p>
                      {s.precio_base > 0 && (
                        <span className="text-xs text-muted-foreground">${Number(s.precio_base).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!s.is_active && <Badge variant="secondary" className="text-[10px]">Inactivo</Badge>}
                    {s.admite_doble_cara && <Badge variant="outline" className="text-[10px]">2 caras</Badge>}
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(s)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar servicio' : 'Nuevo servicio'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            <div>
              <Label>Nombre</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Hoja B/N" />
            </div>
            <div>
              <Label>Icono</Label>
              <IconSelector value={form.icon} onChange={v => setForm(f => ({ ...f, icon: v }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Etiqueta de unidad</Label>
                <Input value={form.unit_label} onChange={e => setForm(f => ({ ...f, unit_label: e.target.value }))} placeholder="hoja" />
              </div>
              <div>
                <Label>Precio base</Label>
                <Input type="number" min={0} step="0.01" value={form.precio_base} onChange={e => setForm(f => ({ ...f, precio_base: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.admite_doble_cara} onCheckedChange={v => setForm(f => ({ ...f, admite_doble_cara: v }))} />
              <Label>Admite doble cara</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.vende_por_tramos} onCheckedChange={v => setForm(f => ({ ...f, vende_por_tramos: v }))} />
              <Label>Vende por tramos</Label>
            </div>
            {form.vende_por_tramos && (
              <div>
                <Label>Tramos por unidad</Label>
                <Input type="number" min={1} step="1" value={form.tramos_por_unidad} onChange={e => setForm(f => ({ ...f, tramos_por_unidad: parseInt(e.target.value) || 1 }))} />
                <p className="text-xs text-muted-foreground mt-1">Cuántos tramos se obtienen de una unidad del insumo</p>
              </div>
            )}
            <div>
              <Label>Insumo que consume</Label>
              <Select value={form.material_id} onValueChange={v => setForm(f => ({ ...f, material_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Seleccionar insumo" /></SelectTrigger>
                <SelectContent>
                  {materials.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Consumo por unidad</Label>
              <Input type="number" min={0} step="0.01" value={form.consumo_por_unidad} onChange={e => setForm(f => ({ ...f, consumo_por_unidad: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <Label>Rendimiento especial (opcional)</Label>
              <Textarea value={rendimientoText} onChange={e => setRendimientoText(e.target.value)} placeholder='Ej: {"hojas_por_tira": 6, "nota": "1 hoja = 6 tiras"}' rows={2} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <Label>Activo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar servicio?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará "{deleteTarget?.name}" permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null); }}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ServiciosTab;
