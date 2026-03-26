import { useState } from 'react';
import {
  calcIngredientCost,
  convertUnits,
  getAllUnits,
  getUnitCategory,
  normalizeUnitKey,
} from '@/lib/unitConversion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, ClipboardList, Pencil, Check, X } from 'lucide-react';
import ServiceCostMethodSection from './ServiceCostMethodSection';

interface Props {
  categoryId: string;
  categoryName: string;
  businessId: string;
  fixedPrice?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CostIngredient {
  id: string;
  material_id: string;
  quantity: number;
  unit: string;
  ingredient_type: 'base' | 'agrego';
  gramaje: number;
  surcharge: number;
  is_raw_material: boolean;
  material?: { id: string; name: string; costo_unitario: number; unit_purchase: string };
}

export default function ServiceCostSheet({ categoryId, categoryName, businessId, fixedPrice, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch category details (yield, cost method)
  const { data: category } = useQuery({
    queryKey: ['service-category-detail', categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*')
        .eq('id', categoryId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!categoryId && open,
  });

  // Fetch ingredients
  const { data: ingredients = [], isLoading } = useQuery({
    queryKey: ['service-cost-ingredients', categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_cost_ingredients' as any)
        .select('*')
        .eq('category_id', categoryId)
        .order('created_at');
      if (error) throw error;

      // Enrich with material info
      const enriched = await Promise.all((data as any[] || []).map(async (row: any) => {
        const { data: mat } = await supabase
          .from('raw_materials')
          .select('id, name, costo_unitario, unit_purchase')
          .eq('id', row.material_id)
          .maybeSingle();
        return {
          ...row,
          material: mat ? {
            id: mat.id,
            name: mat.name,
            costo_unitario: (mat as any).costo_unitario || 0,
            unit_purchase: (mat as any).unit_purchase || 'pieza',
          } : null,
        } as CostIngredient;
      }));
      return enriched;
    },
    enabled: !!categoryId && open,
  });

  // Fetch available raw materials
  const { data: materials = [] } = useQuery({
    queryKey: ['raw-materials-for-service', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raw_materials')
        .select('id, name, costo_unitario, unit_purchase, insumo_areas(name)')
        .eq('business_id', businessId)
        .order('name');
      if (error) throw error;
      return (data || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        costo_unitario: m.costo_unitario || 0,
        unit_purchase: m.unit_purchase || 'pieza',
        area_name: m.insumo_areas?.name || null,
      }));
    },
    enabled: !!businessId && open,
  });

  // Yield mutation
  const updateYield = useMutation({
    mutationFn: async (yieldQty: number) => {
      const { error } = await supabase
        .from('service_categories')
        .update({ yield_quantity: yieldQty } as any)
        .eq('id', categoryId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service-category-detail', categoryId] }),
  });

  // Add ingredient
  const addMutation = useMutation({
    mutationFn: async (payload: { material_id: string; quantity: number; unit: string; ingredient_type: string; gramaje: number; is_raw_material: boolean }) => {
      const { error } = await supabase.from('service_cost_ingredients' as any).insert({
        category_id: categoryId,
        ...payload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-cost-ingredients', categoryId] });
      queryClient.invalidateQueries({ queryKey: ['service-cost-summary'] });
      toast({ title: 'Insumo agregado' });
      setNewIngredientId('');
      setNewQuantity('');
      setNewUnit('');
      setNewType('base');
      setNewGramaje('');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Delete ingredient
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('service_cost_ingredients' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-cost-ingredients', categoryId] });
      queryClient.invalidateQueries({ queryKey: ['service-cost-summary'] });
    },
  });

  // Update ingredient
  const updateIngredient = useMutation({
    mutationFn: async ({ id, quantity, unit }: { id: string; quantity: number; unit: string }) => {
      const { error } = await supabase.from('service_cost_ingredients' as any).update({ quantity, unit }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-cost-ingredients', categoryId] });
      queryClient.invalidateQueries({ queryKey: ['service-cost-summary'] });
      toast({ title: 'Insumo actualizado' });
      setEditingId(null);
    },
  });

  // Update surcharge
  const updateSurcharge = useMutation({
    mutationFn: async ({ id, surcharge }: { id: string; surcharge: number }) => {
      const { error } = await supabase.from('service_cost_ingredients' as any).update({ surcharge }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-cost-ingredients', categoryId] });
      toast({ title: 'Precio de agrego actualizado' });
    },
  });

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editUnit, setEditUnit] = useState('');

  const startEdit = (ing: CostIngredient) => {
    setEditingId(ing.id);
    setEditQty(String(ing.quantity));
    setEditUnit(ing.unit || ing.material?.unit_purchase || 'pieza');
  };

  const confirmEdit = () => {
    if (!editingId || !editQty) return;
    updateIngredient.mutate({ id: editingId, quantity: Number(editQty), unit: editUnit });
  };

  // Add form state
  const [newIngredientId, setNewIngredientId] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newType, setNewType] = useState<'base' | 'agrego'>('base');
  const [newGramaje, setNewGramaje] = useState('');

  const handleIngredientChange = (id: string) => {
    setNewIngredientId(id);
    const mat = materials.find(m => m.id === id);
    if (mat) {
      const normalized = normalizeUnitKey(mat.unit_purchase || 'pieza');
      setNewUnit(normalized);
    }
  };

  const handleAdd = () => {
    if (newType === 'agrego') {
      if (!newIngredientId || !newGramaje) return;
    } else {
      if (!newIngredientId || !newQuantity) return;
    }

    const mat = materials.find(m => m.id === newIngredientId);
    const purchaseUnit = normalizeUnitKey(mat?.unit_purchase || 'pieza');
    const unit = normalizeUnitKey(newUnit || purchaseUnit);
    const qty = newType === 'agrego' ? Number(newGramaje) : Number(newQuantity);

    let gramaje = 0;
    if (newType === 'agrego') {
      const converted = convertUnits(qty, unit, purchaseUnit);
      gramaje = converted ?? qty;
    }

    addMutation.mutate({
      material_id: newIngredientId,
      quantity: qty,
      unit: unit || 'pieza',
      ingredient_type: newType,
      gramaje,
      is_raw_material: true,
    });
  };

  // Cost calculations
  const calcCost = (ing: CostIngredient): number => {
    const mat = ing.material;
    if (!mat) return 0;
    const costPerUnit = Number(mat.costo_unitario);
    const purchaseUnit = mat.unit_purchase || 'pieza';
    return calcIngredientCost(ing.quantity, ing.unit || purchaseUnit, costPerUnit, purchaseUnit);
  };

  const baseIngredients = ingredients.filter(i => i.ingredient_type === 'base');
  const agregoIngredients = ingredients.filter(i => i.ingredient_type === 'agrego');

  const recipeCost = baseIngredients.reduce((sum, i) => sum + calcCost(i), 0);
  const yieldQty = category?.yield_quantity || 1;
  const costPerUnit = recipeCost / yieldQty;
  const price = fixedPrice != null ? Number(fixedPrice) : 0;
  const margin = price > 0 ? ((price - costPerUnit) / price * 100) : 0;

  const [adjustedCostState, setAdjustedCostState] = useState<number | null>(null);

  // Render ingredient row
  const renderIngredient = (ing: CostIngredient, isAgrego: boolean) => {
    const cost = calcCost(ing);
    const purchaseUnit = ing.material?.unit_purchase || 'pieza';
    const showConversion = ing.unit && ing.unit !== purchaseUnit && getUnitCategory(ing.unit) !== 'unit';
    const isEditing = editingId === ing.id;

    return (
      <div key={ing.id} className={`flex items-center justify-between rounded-md border ${isAgrego ? 'border-dashed' : ''} p-2 gap-2`}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{ing.material?.name || 'Desconocido'}</p>
          {isEditing ? (
            <div className="flex items-center gap-1.5 mt-1">
              <Input type="number" min={0.01} step={0.01} className="w-20 h-7 text-xs" value={editQty} onChange={(e) => setEditQty(e.target.value)} />
              <select value={editUnit} onChange={(e) => setEditUnit(e.target.value)} className="h-7 rounded-md border border-input bg-background px-1.5 text-xs">
                {getAllUnits().map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {ing.quantity} {ing.unit}
              {isAgrego && ' por unidad vendida'}
              {showConversion && (
                <span className="text-muted-foreground/60">
                  {isAgrego ? ` (consume ${ing.gramaje} ${purchaseUnit})` : ` (compra en ${purchaseUnit})`}
                </span>
              )}
              {' · '}
              <span className="font-medium text-foreground">${cost.toFixed(2)}{isAgrego ? ' costo' : ''}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {isAgrego && !isEditing && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">+$</span>
              <Input
                type="number"
                min={0}
                step={0.5}
                className="w-16 h-7 text-xs text-center"
                defaultValue={ing.surcharge || 0}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v !== (ing.surcharge || 0)) {
                    updateSurcharge.mutate({ id: ing.id, surcharge: v });
                  }
                }}
              />
            </div>
          )}
          {isEditing ? (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-500" onClick={confirmEdit} disabled={updateIngredient.isPending}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setEditingId(null)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => startEdit(ing)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(ing.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Ficha de costo: {categoryName}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Yield */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium whitespace-nowrap">Rinde:</label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  className="w-24"
                  defaultValue={yieldQty}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v > 0 && v !== yieldQty) updateYield.mutate(v);
                  }}
                />
                <span className="text-sm text-muted-foreground">unidades por preparación</span>
              </div>

              <Separator />

              {/* Cost summary cards */}
              {(() => {
                const displayCost = adjustedCostState != null ? adjustedCostState : costPerUnit;
                const displayMargin = price > 0 ? ((price - displayCost) / price * 100) : 0;
                return (
                  <div className="grid grid-cols-3 gap-2">
                    <Card className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Costo ficha</p>
                      <p className="text-lg font-bold">${recipeCost.toFixed(2)}</p>
                    </Card>
                    <Card className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Costo/unidad</p>
                      <p className="text-lg font-bold">${displayCost.toFixed(2)}</p>
                    </Card>
                    <Card className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Margen</p>
                      <p className={`text-lg font-bold ${displayMargin >= 30 ? 'text-green-600' : displayMargin >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {price > 0 ? `${displayMargin.toFixed(1)}%` : '—'}
                      </p>
                    </Card>
                  </div>
                );
              })()}

              <Separator />

              {/* Base ingredients */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Insumos base <Badge variant="secondary" className="text-[10px] ml-1">Siempre se consumen</Badge></p>
                {baseIngredients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin insumos base.</p>
                ) : (
                  <div className="space-y-1.5">
                    {baseIngredients.map(i => renderIngredient(i, false))}
                  </div>
                )}
              </div>

              {/* Agrego ingredients */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Agregos <Badge variant="outline" className="text-[10px] ml-1">Opcionales</Badge></p>
                {agregoIngredients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin agregos configurados.</p>
                ) : (
                  <div className="space-y-1.5">
                    {agregoIngredients.map(i => renderIngredient(i, true))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Add ingredient */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Agregar insumo</p>
                {materials.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No hay insumos disponibles. Crea uno primero en Inventario.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={newIngredientId}
                        onChange={(e) => handleIngredientChange(e.target.value)}
                        className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Seleccionar...</option>
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.unit_purchase}){m.area_name ? ` - ${m.area_name}` : ''}</option>
                        ))}
                      </select>
                      <select
                        value={newType}
                        onChange={(e) => setNewType(e.target.value as 'base' | 'agrego')}
                        className="flex h-10 w-28 rounded-md border border-input bg-background px-2 py-2 text-sm"
                      >
                        <option value="base">Base</option>
                        <option value="agrego">Agrego</option>
                      </select>
                    </div>
                    <div className="flex gap-2 items-end">
                      {newType === 'agrego' ? (
                        <Input
                          type="number"
                          min={0.01}
                          step={0.01}
                          placeholder="Cant."
                          className="w-24"
                          value={newGramaje}
                          onChange={(e) => setNewGramaje(e.target.value)}
                        />
                      ) : (
                        <Input
                          type="number"
                          min={0.01}
                          step={0.01}
                          placeholder="Cant."
                          className="w-20"
                          value={newQuantity}
                          onChange={(e) => setNewQuantity(e.target.value)}
                        />
                      )}
                      <select
                        value={newUnit}
                        onChange={(e) => setNewUnit(e.target.value)}
                        className="flex h-10 w-28 rounded-md border border-input bg-background px-2 py-2 text-sm"
                      >
                        {getAllUnits().map(u => (
                          <option key={u.value} value={u.value}>{u.label}</option>
                        ))}
                      </select>
                      <Button
                        size="icon"
                        className="flex-shrink-0"
                        onClick={handleAdd}
                        disabled={!newIngredientId || (newType === 'agrego' ? !newGramaje : !newQuantity) || addMutation.isPending}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Conversion hint */}
                    {(() => {
                      const mat = materials.find(m => m.id === newIngredientId);
                      if (!mat) return null;
                      const purchaseUnit = normalizeUnitKey(mat.unit_purchase || 'pieza');
                      const selectedUnit = normalizeUnitKey(newUnit || purchaseUnit);
                      if (selectedUnit === purchaseUnit) return null;
                      const rawQty = newType === 'agrego' ? Number(newGramaje) : Number(newQuantity);
                      if (!rawQty || rawQty <= 0) return null;
                      const converted = convertUnits(rawQty, selectedUnit, purchaseUnit);
                      if (converted === null) return (
                        <p className="text-xs text-destructive">⚠ Unidades incompatibles: no se puede convertir de {selectedUnit} a {purchaseUnit}</p>
                      );
                      return (
                        <p className="text-xs text-muted-foreground">
                          ≈ {converted.toFixed(4)} {purchaseUnit} (unidad de compra)
                        </p>
                      );
                    })()}
                  </div>
                )}
              </div>

              <Separator />

              {/* Cost breakdown */}
              <div className="rounded-lg border bg-muted/50 p-3 space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Desglose de costo</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Costo insumos (ficha)</span>
                  <span className="font-medium">${costPerUnit.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-semibold">
                  <span>Costo base total</span>
                  <span>${costPerUnit.toFixed(2)}</span>
                </div>
              </div>

              {/* Cost method section */}
              <ServiceCostMethodSection
                categoryId={categoryId}
                baseCost={costPerUnit}
                salePrice={price}
                costMethod={category?.cost_method || 'direct'}
                indirectPct={category?.indirect_cost_percentage || 0}
                indirectAmount={category?.indirect_cost_amount || 0}
                onCostUpdate={(cost) => setAdjustedCostState(cost)}
                onSaved={() => {
                  queryClient.invalidateQueries({ queryKey: ['service-category-detail', categoryId] });
                  queryClient.invalidateQueries({ queryKey: ['service-cost-summary'] });
                  setAdjustedCostState(null);
                }}
              />
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
