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

  // Filter products: ingredientes belonging to the selected area
  const areaProducts = selectedArea
    ? products.filter((p: any) => p.tipo === 'ingrediente' && p.insumo_area_id === selectedArea.id)
    : [];

  // Filter raw_materials belonging to the selected area
  const areaRawMaterials = selectedArea
    ? rawMaterials.filter((m: any) => m.area_id === selectedArea.id)
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
      const { error } = await supabase.from('raw_materials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
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
        </div>

        {areaProducts.length === 0 && areaRawMaterials.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">Sin insumos asignados a esta área</p>
            <p className="text-xs mt-1">Crea un nuevo insumo con el botón de arriba</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Raw materials */}
            {areaRawMaterials.map((mat: any) => {
              const stock = Number(mat.stock_vendedor) || 0;
              const wStock = Number(mat.stock_almacen) || 0;
              const totalStock = stock + wStock;
              const costoUnit = Number(mat.costo_unitario) || 0;
              const valorTotal = totalStock * costoUnit;
              const isLow = mat.stock_minimo > 0 && totalStock <= mat.stock_minimo && totalStock > 0;
              const isOut = totalStock <= 0;

              const asProduct = {
                id: mat.id,
                name: mat.name,
                code: mat.code || '',
                description: mat.description || '',
                sale_price: 0,
                cost_price: costoUnit,
                min_stock: mat.stock_minimo || 0,
                unit: mat.unit || 'unidad',
                image_url: null,
                is_active: true,
                business_id: mat.business_id,
                category_id: null,
                created_at: mat.created_at,
                updated_at: mat.updated_at || mat.created_at,
                tipo: 'ingrediente',
                insumo_area_id: mat.area_id,
                status: 'active',
                barcode: null,
                supplier: null,
                unit_of_measure: mat.unit || 'unidad',
                brand: mat.brand || null,
                category: null,
                _isRawMaterial: true,
              } as unknown as Product & { category: Category | null };

              return (
                <div key={`rm-${mat.id}`} className="rounded-lg border bg-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => onSelectProduct(asProduct)}
                    className="w-full text-left p-3 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{mat.name}</p>
                          {mat.brand && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{mat.brand}</span>
                          )}
                          {(isLow || isOut) && (
                            <AlertTriangle className={cn("h-3.5 w-3.5 shrink-0", isOut ? "text-destructive" : "text-amber-500")} />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Metrics grid */}
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      <div className="rounded-md bg-muted/60 p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">En uso</p>
                        <p className={cn("text-sm font-bold", isOut && "text-destructive", isLow && !isOut && "text-amber-500")}>
                          {stock}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/60 p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Almacén</p>
                        <p className="text-sm font-bold">{wStock}</p>
                      </div>
                      <div className="rounded-md bg-muted/60 p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Costo</p>
                        <p className="text-sm font-bold">${costoUnit.toFixed(2)}</p>
                      </div>
                      <div className="rounded-md bg-muted/60 p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Valor</p>
                        <p className="text-sm font-bold">${valorTotal.toFixed(2)}</p>
                      </div>
                    </div>
                  </button>

                  {/* Action buttons */}
                  {canManage && (
                    <div className="flex items-center gap-1 px-3 pb-3 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-8"
                        onClick={(e) => { e.stopPropagation(); onAddStock(asProduct); }}
                      >
                        <PackagePlus className="h-3.5 w-3.5 mr-1" />
                        Nueva Compra
                      </Button>
                      {(wStock > 0 || stock > 0) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs h-8"
                          onClick={(e) => { e.stopPropagation(); onTransfer?.(asProduct, wStock > 0 ? 'toSale' : 'toWarehouse'); }}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                          {wStock > 0 ? 'Almacén → Uso' : 'Uso → Almacén'}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs h-8 text-destructive hover:text-destructive"
                        onClick={() => deleteRawMaterial.mutate(mat.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Product-based ingredientes */}
            {areaProducts.map((product) => {
              const stock = stockMap.get(product.id) || 0;
              const wStock = warehouseStockMap.get(product.id) || 0;
              const totalStock = stock + wStock;
              const valorTotal = totalStock * Number(product.cost_price);
              const isLow = stock <= product.min_stock && stock > 0;
              const isOut = stock <= 0;

              return (
                <div
                  key={product.id}
                  className="rounded-lg border bg-card overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => onSelectProduct(product)}
                    className="w-full text-left p-3 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{product.name}</p>
                          {product.unit_of_measure && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{product.unit_of_measure}</span>
                          )}
                          {(isLow || isOut) && (
                            <AlertTriangle className={cn("h-3.5 w-3.5 shrink-0", isOut ? "text-destructive" : "text-amber-500")} />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      <div className="rounded-md bg-muted/60 p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">En uso</p>
                        <p className={cn("text-sm font-bold", isOut && "text-destructive", isLow && !isOut && "text-amber-500")}>
                          {stock}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/60 p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Almacén</p>
                        <p className="text-sm font-bold">{wStock}</p>
                      </div>
                      <div className="rounded-md bg-muted/60 p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Costo</p>
                        <p className="text-sm font-bold">${Number(product.cost_price).toFixed(2)}</p>
                      </div>
                      <div className="rounded-md bg-muted/60 p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Valor</p>
                        <p className="text-sm font-bold">${valorTotal.toFixed(2)}</p>
                      </div>
                    </div>
                  </button>
                  {canManage && (
                    <div className="flex items-center gap-1 px-3 pb-3 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddStock(product);
                        }}
                      >
                        <PackagePlus className="h-3.5 w-3.5 mr-1" />
                        Nueva Compra
                      </Button>
                      {(wStock > 0 || stock > 0) && onTransfer && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTransfer(product, wStock > 0 ? 'toSale' : 'toWarehouse');
                          }}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                          {wStock > 0 ? 'Almacén → Uso' : 'Uso → Almacén'}
                        </Button>
                      )}
                      {wStock > 0 && onOutflow && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOutflow(product);
                          }}
                        >
                          <PackageX className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {onDeleteProduct && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteProduct(product);
                          }}
                        >
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
    </div>
  );
};

export default InsumosInventoryTab;