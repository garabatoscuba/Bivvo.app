import { useState } from 'react';
import { usePrintPrinters, useSavePrinter, useDeletePrinter } from '@/hooks/usePrintPrinters';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Printer, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const ALL_COLORS = [
  { value: 'negro', label: 'Negro', dot: 'bg-gray-900 dark:bg-gray-600' },
  { value: 'cian', label: 'Cian', dot: 'bg-cyan-500' },
  { value: 'magenta', label: 'Magenta', dot: 'bg-pink-500' },
  { value: 'amarillo', label: 'Amarillo', dot: 'bg-yellow-400' },
];

interface PrinterForm {
  id?: string;
  name: string;
  colores: string[];
  soporta_full: boolean;
  is_active: boolean;
}

const EMPTY_FORM: PrinterForm = { name: '', colores: ['negro'], soporta_full: false, is_active: true };

export default function PrinterManager() {
  const { data: printers = [], isLoading } = usePrintPrinters();
  const saveMut = useSavePrinter();
  const deleteMut = useDeletePrinter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PrinterForm>(EMPTY_FORM);

  const openNew = () => { setForm(EMPTY_FORM); setOpen(true); };
  const openEdit = (p: any) => {
    setForm({ id: p.id, name: p.name, colores: p.colores || ['negro'], soporta_full: p.soporta_full, is_active: p.is_active });
    setOpen(true);
  };

  const toggleColor = (color: string) => {
    setForm(f => {
      const has = f.colores.includes(color);
      if (has && f.colores.length === 1) return f; // must have at least one
      return { ...f, colores: has ? f.colores.filter(c => c !== color) : [...f.colores, color] };
    });
  };

  const handleSave = () => {
    if (!form.name.trim()) return;
    saveMut.mutate(form, { onSuccess: () => setOpen(false) });
  };

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Printer className="h-4 w-4" /> Mis Impresoras
        </h3>
        <Button size="sm" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1" /> Agregar</Button>
      </div>

      {printers.length === 0 ? (
        <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">
          No hay impresoras configuradas. Agrega una para mejorar el cálculo de consumo de tinta.
        </CardContent></Card>
      ) : (
        <div className="grid gap-2">
          {printers.map((p: any) => (
            <Card key={p.id} className={!p.is_active ? 'opacity-50' : ''}>
              <CardContent className="p-3 flex items-center gap-3">
                <Printer className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {(p.colores || []).map((c: string) => {
                      const col = ALL_COLORS.find(ac => ac.value === c);
                      return col ? (
                        <div key={c} className="flex items-center gap-1">
                          <div className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                          <span className="text-[10px] text-muted-foreground">{col.label}</span>
                        </div>
                      ) : null;
                    })}
                    {p.soporta_full && <Badge variant="outline" className="text-[10px] h-4">Full</Badge>}
                    {!p.is_active && <Badge variant="secondary" className="text-[10px] h-4">Inactiva</Badge>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMut.mutate(p.id)} disabled={deleteMut.isPending}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{form.id ? 'Editar' : 'Nueva'} impresora</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Epson L3150" />
            </div>
            <div>
              <Label className="mb-2 block">Colores que usa</Label>
              <div className="grid grid-cols-2 gap-2">
                {ALL_COLORS.map(c => (
                  <label key={c.value} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/50">
                    <Checkbox checked={form.colores.includes(c.value)} onCheckedChange={() => toggleColor(c.value)} />
                    <div className={`h-3 w-3 rounded-full ${c.dot}`} />
                    <span className="text-sm">{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={form.soporta_full} onCheckedChange={v => setForm(f => ({ ...f, soporta_full: v }))} />
              <span className="text-sm">Soporta Full</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
              <span className="text-sm">Activa</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || saveMut.isPending}>
              {saveMut.isPending ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
