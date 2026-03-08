import { useState } from 'react';
import { usePrintRecipes, useRawMaterials, useSavePrintRecipe } from '@/hooks/usePrintData';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Loader2, ChefHat } from 'lucide-react';

interface RecipeMaterial {
  material_id: string;
  cantidad_por_produccion: number;
}

const emptyRecipe = { id: '', name: '', descripcion: '', unidades_produce: 1, is_active: true };

const RecetasTab = () => {
  const { data: recipes = [], isLoading } = usePrintRecipes();
  const { data: materials = [] } = useRawMaterials();
  const saveMutation = useSavePrintRecipe();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyRecipe);
  const [recipeMaterials, setRecipeMaterials] = useState<RecipeMaterial[]>([]);

  const openNew = () => {
    setForm(emptyRecipe);
    setRecipeMaterials([]);
    setOpen(true);
  };

  const openEdit = (r: any) => {
    setForm({
      id: r.id,
      name: r.name,
      descripcion: r.descripcion || '',
      unidades_produce: r.unidades_produce,
      is_active: r.is_active,
    });
    setRecipeMaterials(
      (r.print_recipe_materials || []).map((rm: any) => ({
        material_id: rm.material_id,
        cantidad_por_produccion: rm.cantidad_por_produccion,
      }))
    );
    setOpen(true);
  };

  const addRow = () => setRecipeMaterials(prev => [...prev, { material_id: '', cantidad_por_produccion: 0 }]);

  const updateRow = (idx: number, field: string, value: any) => {
    setRecipeMaterials(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const removeRow = (idx: number) => {
    setRecipeMaterials(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const recipe = { ...form };
    if (!recipe.id) delete (recipe as any).id;
    const validMaterials = recipeMaterials.filter(m => m.material_id && m.cantidad_por_produccion > 0);
    saveMutation.mutate({ recipe, materials: validMaterials }, { onSuccess: () => setOpen(false) });
  };

  const getMaterialName = (id: string) => materials.find((m: any) => m.id === id)?.name || '—';

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recetas</h2>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" />Nueva receta</Button>
      </div>

      {recipes.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">No hay recetas creadas</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {recipes.map((r: any) => (
            <Card key={r.id} className={!r.is_active ? 'opacity-60' : ''}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <ChefHat className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{r.name}</p>
                      {r.descripcion && <p className="text-xs text-muted-foreground">{r.descripcion}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!r.is_active && <Badge variant="secondary">Inactiva</Badge>}
                    <Badge variant="outline">Produce {r.unidades_produce}</Badge>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  </div>
                </div>
                {r.print_recipe_materials?.length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-0.5">
                    {r.print_recipe_materials.map((rm: any) => (
                      <p key={rm.id}>• {rm.raw_materials?.name || '—'} × {rm.cantidad_por_produccion}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Editar receta' : 'Nueva receta'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            <div>
              <Label>Nombre del producto fabricado</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Distintivo escolar" />
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Textarea value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Unidades que produce</Label>
                <Input type="number" min={1} value={form.unidades_produce} onChange={e => setForm(f => ({ ...f, unidades_produce: parseInt(e.target.value) || 1 }))} />
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label>Activa</Label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Insumos que consume</Label>
                <Button type="button" variant="outline" size="sm" onClick={addRow}><Plus className="h-3 w-3 mr-1" />Agregar</Button>
              </div>
              {recipeMaterials.length > 0 && (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Insumo</TableHead>
                        <TableHead className="w-24">Cantidad</TableHead>
                        <TableHead className="w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recipeMaterials.map((rm, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <Select value={rm.material_id} onValueChange={v => updateRow(idx, 'material_id', v)}>
                              <SelectTrigger className="h-8"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                              <SelectContent>
                                {materials.map((m: any) => (
                                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={0} step="0.01" className="h-8" value={rm.cantidad_por_produccion || ''} onChange={e => updateRow(idx, 'cantidad_por_produccion', parseFloat(e.target.value) || 0)} />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRow(idx)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {recipeMaterials.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">Sin insumos agregados</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecetasTab;
