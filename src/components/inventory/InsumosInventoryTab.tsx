import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, Loader2, Pencil, Trash2, PackagePlus, AlertTriangle, ArrowRightLeft, PackageX } from 'lucide-react';
import { getIconComponent } from '@/components/services/IconSelector';
import IconSelector from '@/components/services/IconSelector';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { Product, Category } from '@/types/database';

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

const AREA_COLOR_BADGE: Record<string, string> = {
  blue: 'bg-blue-500 text-white',
  green: 'bg-green-500 text-white',
  orange: 'bg-orange-500 text-white',
  purple: 'bg-purple-500 text-white',
  pink: 'bg-pink-500 text-white',
  red: 'bg-red-500 text-white',
  yellow: 'bg-yellow-500 text-black',
  teal: 'bg-teal-500 text-white',
};

interface InsumosInventoryTabProps {
  products: (Product & { category: Category | null })[];
  stockMap: Map<string, number>;
  warehouseStockMap: Map<string, number>;
  onSelectProduct: (product: Product & { category: Category | null }) => void;
  onAddStock: (product: Product) => void;
  onOutflow?: (product: Product) => void;
  onTransfer?: (product: Product, direction: 'toSale' | 'toWarehouse') => void;
  onDeleteProduct?: (product: Product) => void;
  canManage: boolean;
  searchQuery?: string;
}

const InsumosInventoryTab = ({
  products,
  stockMap,
  warehouseStockMap,
  onSelectProduct,
  onAddStock,
  onOutflow,
  onTransfer,
  onDeleteProduct,
  canManage,
  searchQuery = '',
}: InsumosInventoryTabProps) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const businessId = profile?.business_id;

  const [selectedArea, setSelectedArea] = useState<any>(null);
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<any>(null);
  const [areaForm, setAreaForm] = useState({ name: '', icon: 'Package', color: 'blue' });
  const [deletingArea, setDeletingArea] = useState<any>(null);
  const [newInsumoOpen, setNewInsumoOpen] = useState(false);
  const [insumoForm, setInsumoForm] = useState({ name: '', description: '', brand: '', area_id: '' });

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

  // ─── Raw materials query ───
  const { data: rawMaterials = [] } = useQuery({
    queryKey: ['raw-materials', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('raw_materials')
        .select('*')
        .eq('business_id', businessId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId,
  });

  const matchesSearch = (name: string, brand?: string | null, description?: string | null) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (name || '').toLowerCase().includes(q) ||
      (brand || '').toLowerCase().includes(q) ||
      (description || '').toLowerCase().includes(q);
  };

  // Filter products: ingredientes belonging to the selected area
  const areaProducts = selectedArea
    ? products.filter((p: any) => p.tipo === 'ingrediente' && p.insumo_area_id === selectedArea.id && matchesSearch(p.name, p.brand, p.description))
    : [];

  // Filter raw_materials belonging to the selected area
  const areaRawMaterials = selectedArea
    ? rawMaterials.filter((m: any) => m.area_id === selectedArea.id && matchesSearch(m.name, m.brand, m.description))
    : [];

  // Count per area (products + raw_materials)
  const areaCountMap = new Map<string, number>();
  products.forEach((p: any) => {
    if (p.tipo === 'ingrediente' && p.insumo_area_id) {
      areaCountMap.set(p.insumo_area_id, (areaCountMap.get(p.insumo_area_id) || 0) + 1);
    }
  });
  rawMaterials.forEach((m: any) => {
    if (m.area_id) {
      areaCountMap.set(m.area_id, (areaCountMap.get(m.area_id) || 0) + 1);
    }
  });

  // Unassigned ingredientes (no area)
  const unassignedCount = products.filter((p: any) => p.tipo === 'ingrediente' && !p.insumo_area_id).length
    + rawMaterials.filter((m: any) => !m.area_id).length;

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
      // Unassign products from this area first
      await supabase.from('products').update({ insumo_area_id: null }).eq('insumo_area_id', id);
      const { error } = await supabase.from('insumo_areas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insumo-areas'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDeletingArea(null);
      toast({ title: 'Área eliminada' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ─── Delete raw material ───
  const deleteRawMaterial = useMutation({
    mutationFn: async (id: string) => {
      // Remove any recipe_ingredients referencing this raw material
      await supabase.from('recipe_ingredients').delete().eq('ingredient_id', id).eq('is_raw_material', true);
      const { error } = await supabase.from('raw_materials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      queryClient.invalidateQueries({ queryKey: ['raw-materials-for-products'] });
      queryClient.invalidateQueries({ queryKey: ['raw-materials-for-recipe'] });
      queryClient.invalidateQueries({ queryKey: ['recipe'] });
      queryClient.invalidateQueries({ queryKey: ['recipe-ingredients'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Insumo eliminado' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const saveInsumo = useMutation({
    mutationFn: async (form: typeof insumoForm) => {
      if (!businessId) throw new Error('No business');
      const { error } = await supabase.from('raw_materials').insert({
        business_id: businessId,
        name: form.name,
        description: form.description || null,
        brand: form.brand || null,
        area_id: form.area_id || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      setNewInsumoOpen(false);
      setInsumoForm({ name: '', description: '', brand: '', area_id: '' });
      toast({ title: 'Insumo creado' });
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

  if (areasLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  // ─── Shared dialogs fragment (rendered always) ───
  const dialogs = (
    <>
      {/* Area Dialog */}
      <Dialog open={areaDialogOpen} onOpenChange={(o) => { setAreaDialogOpen(o); if (!o) setEditingArea(null); }}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>{editingArea ? 'Editar área' : 'Nueva área'}</DialogTitle></DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            <div>
              <Label>Nombre</Label>
              <Input value={areaForm.name} onChange={e => setAreaForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Carnes, Lácteos, Verduras" />
            </div>
            <div>
              <Label>Ícono</Label>
              <IconSelector value={areaForm.icon} onChange={v => setAreaForm(f => ({ ...f, icon: v }))} />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {AREA_COLORS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setAreaForm(f => ({ ...f, color: c.value }))}
                    className={cn(
                      'h-8 w-8 rounded-full border-2 transition-all',
                      c.class,
                      areaForm.color === c.value ? 'border-foreground scale-110' : 'border-transparent'
                    )}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
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

      {/* Nuevo Insumo Dialog */}
      <Dialog open={newInsumoOpen} onOpenChange={(o) => { setNewInsumoOpen(o); if (!o) setInsumoForm({ name: '', description: '', brand: '', area_id: '' }); }}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader><DialogTitle>Nuevo Insumo</DialogTitle></DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            <div>
              <Label>Nombre</Label>
              <Input value={insumoForm.name} onChange={e => setInsumoForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Harina de trigo" />
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Textarea value={insumoForm.description} onChange={e => setInsumoForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Detalles del insumo" />
            </div>
            <div>
              <Label>Marca (opcional)</Label>
              <Input value={insumoForm.brand} onChange={e => setInsumoForm(f => ({ ...f, brand: e.target.value }))} placeholder="Ej: La Estrella" />
            </div>
            <div>
              <Label>Área (opcional)</Label>
              <Select value={insumoForm.area_id} onValueChange={v => setInsumoForm(f => ({ ...f, area_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Sin área" /></SelectTrigger>
                <SelectContent>
                  {areas.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewInsumoOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveInsumo.mutate(insumoForm)} disabled={!insumoForm.name.trim() || saveInsumo.isPending}>
              {saveInsumo.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Area Confirmation */}
      <AlertDialog open={!!deletingArea} onOpenChange={(o) => !o && setDeletingArea(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar área?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{deletingArea?.name}". Los insumos asignados quedarán sin área.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingArea && deleteArea.mutate(deletingArea.id)}
              className="bg-destructive text-destructive-foreground"
            >
              {deleteArea.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  // ─── Level 2: Ingredients in area ───
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
            <Badge variant="secondary" className="text-xs">{areaProducts.length + areaRawMaterials.length}</Badge>
          </div>
          {canManage && (
            <Button size="sm" variant="outline" onClick={() => { setInsumoForm({ name: '', description: '', brand: '', area_id: selectedArea.id }); setNewInsumoOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />Nuevo insumo
            </Button>
          )}
        </div>

        {areaProducts.length === 0 && areaRawMaterials.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">Sin insumos asignados a esta área</p>
            <p className="text-xs mt-1">Crea un nuevo insumo con el botón de arriba</p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Raw materials rows */}
            {areaRawMaterials.map((mat: any) => {
              const stock = Number(mat.stock_vendedor) || 0;
              const wStock = Number(mat.stock_almacen) || 0;
              const totalStock = stock + wStock;
              const isLow = mat.stock_minimo > 0 && totalStock <= mat.stock_minimo && totalStock > 0;
              const isOut = totalStock <= 0;
              const costoUnit = Number(mat.costo_unitario) || 0;
              const materialUnit = mat.unit_purchase || mat.unit_use || 'Pieza';

              const asProduct = {
                id: mat.id,
                business_id: mat.business_id,
                code: mat.code || '',
                name: mat.name,
                description: mat.description || '',
                cost_price: costoUnit,
                sale_price: 0,
                image_url: null,
                min_stock: mat.stock_minimo || 0,
                category_id: mat.category_id || null,
                created_at: mat.created_at,
                updated_at: mat.updated_at || mat.created_at,
                tipo: 'ingrediente',
                insumo_area_id: mat.area_id,
                status: 'active',
                barcode: null,
                supplier: null,
                unit_of_measure: materialUnit,
                brand: mat.brand || null,
                category: null,
                _isRawMaterial: true,
                stock_vendedor: stock,
                stock_almacen: wStock,
              } as unknown as Product & { category: Category | null };

              const areaColor = selectedArea?.color || 'blue';
              const badgeBg = AREA_COLOR_BADGE[areaColor] || 'bg-primary text-primary-foreground';

              return (
                <div key={`rm-${mat.id}`} className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-muted/50 transition-colors group">
                  <button
                    className="flex items-center gap-2 flex-1 text-left min-w-0"
                    onClick={() => onSelectProduct(asProduct)}
                  >
                    <div className="flex gap-1 flex-shrink-0">
                      <span className={cn('inline-flex items-center justify-center h-8 min-w-[2.2rem] px-1.5 rounded-md text-xs font-semibold', badgeBg)} title="En uso">
                        {stock}
                      </span>
                      <span className="inline-flex items-center justify-center h-8 min-w-[2.2rem] px-1.5 rounded-md text-xs font-semibold bg-muted text-muted-foreground" title="Almacén">
                        {wStock}
                      </span>
                    </div>
                    <span className="font-medium text-sm truncate flex-1">{mat.name}</span>
                    {(isLow || isOut) && <AlertTriangle className={cn("h-3.5 w-3.5 flex-shrink-0", isOut ? "text-destructive" : "text-warning")} />}
                  </button>
                  {canManage && (
                    <div className="flex gap-0.5 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onAddStock(asProduct); }} title="Nueva Compra">
                        <PackagePlus className="h-3.5 w-3.5" />
                      </Button>
                      {(wStock > 0 || stock > 0) && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onTransfer?.(asProduct, wStock > 0 ? 'toSale' : 'toWarehouse'); }} title={wStock > 0 ? 'Almacén → Uso' : 'Uso → Almacén'}>
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); deleteRawMaterial.mutate(mat.id); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Product-based ingredientes rows */}
            {areaProducts.map((product) => {
              const stock = stockMap.get(product.id) || 0;
              const wStock = warehouseStockMap.get(product.id) || 0;
              const isLow = stock <= product.min_stock && stock > 0;
              const isOut = stock <= 0;

              const areaColor = selectedArea?.color || 'blue';
              const badgeBg = AREA_COLOR_BADGE[areaColor] || 'bg-primary text-primary-foreground';

              return (
                <div key={product.id} className="flex items-center gap-2 py-1.5 px-1 rounded-lg hover:bg-muted/50 transition-colors group">
                  <button
                    className="flex items-center gap-2 flex-1 text-left min-w-0"
                    onClick={() => onSelectProduct(product)}
                  >
                    <div className="flex gap-1 flex-shrink-0">
                      <span className={cn('inline-flex items-center justify-center h-8 min-w-[2.2rem] px-1.5 rounded-md text-xs font-semibold', badgeBg)} title="En uso">
                        {stock}
                      </span>
                      <span className="inline-flex items-center justify-center h-8 min-w-[2.2rem] px-1.5 rounded-md text-xs font-semibold bg-muted text-muted-foreground" title="Almacén">
                        {wStock}
                      </span>
                    </div>
                    <span className="font-medium text-sm truncate flex-1">{product.name}</span>
                    {(isLow || isOut) && <AlertTriangle className={cn("h-3.5 w-3.5 flex-shrink-0", isOut ? "text-destructive" : "text-warning")} />}
                  </button>
                  {canManage && (
                    <div className="flex gap-0.5 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onAddStock(product); }} title="Nueva Compra">
                        <PackagePlus className="h-3.5 w-3.5" />
                      </Button>
                      {(wStock > 0 || stock > 0) && onTransfer && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onTransfer(product, wStock > 0 ? 'toSale' : 'toWarehouse'); }} title={wStock > 0 ? 'Almacén → Uso' : 'Uso → Almacén'}>
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {onDeleteProduct && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={(e) => { e.stopPropagation(); onDeleteProduct(product); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {dialogs}
      </div>
    );
  }

  // ─── Level 1: Areas ───
  return (
    <div className="space-y-4">
      {/* Inline summary */}
      {(() => {
        const ingredientProducts = products.filter((p: any) => p.tipo === 'ingrediente');
        const totalInsumos = ingredientProducts.length + rawMaterials.length;
        const totalValue = ingredientProducts.reduce((sum, p) => {
          const s = stockMap.get(p.id) || 0;
          const w = warehouseStockMap.get(p.id) || 0;
          return sum + (s + w) * Number(p.cost_price);
        }, 0) + rawMaterials.reduce((sum: number, m: any) => {
          return sum + ((Number(m.stock_vendedor) || 0) + (Number(m.stock_almacen) || 0)) * (Number(m.cost_price) || 0);
        }, 0);
        return (
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span><span className="font-semibold text-foreground">{totalInsumos}</span> insumos</span>
            <span>·</span>
            <span>Valor: <span className="font-semibold text-foreground">${totalValue.toLocaleString('en', { minimumFractionDigits: 2 })}</span></span>
          </div>
        );
      })()}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Áreas de insumos</h2>
        {canManage && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setInsumoForm({ name: '', description: '', brand: '', area_id: '' }); setNewInsumoOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />Nuevo insumo
            </Button>
            <Button size="sm" onClick={openNewArea}>
              <Plus className="h-4 w-4 mr-1" />Nueva área
            </Button>
          </div>
        )}
      </div>

      {areas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Crea áreas para organizar tus insumos</p>
          {canManage && (
            <Button size="sm" variant="outline" className="mt-3" onClick={openNewArea}>
              <Plus className="h-4 w-4 mr-1" />Crear primera área
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {areas.map((area: any) => {
            const Icon = getIconComponent(area.icon);
            const count = areaCountMap.get(area.id) || 0;
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
                  {canManage && (
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
                  )}
                </div>
                <p className="font-medium text-sm">{area.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{count} insumo{count !== 1 ? 's' : ''}</p>
              </button>
            );
          })}
        </div>
      )}

      {unassignedCount > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {unassignedCount} insumo{unassignedCount !== 1 ? 's' : ''} sin área asignada
        </p>
      )}

      {dialogs}
    </div>
  );
};

export default InsumosInventoryTab;