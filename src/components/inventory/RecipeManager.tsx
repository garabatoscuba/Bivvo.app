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
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/hooks/useProducts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, ChefHat, Pencil, Check, X } from 'lucide-react';
import CostMethodSection from '@/components/inventory/CostMethodSection';
import type { Product } from '@/types/database';

interface RecipeManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product;
}

interface RecipeIngredient {
  id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  ingredient_type: 'base' | 'agrego';
  gramaje: number;
  ingredient?: { id: string; name: string; cost_price: number; unit_of_measure: string };
}

export const RecipeManager = ({ open, onOpenChange, product }: RecipeManagerProps) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const businessId = profile?.business_id;

  // Fetch raw_materials (insumos) as available ingredients
  const { data: rawMaterials } = useQuery({
    queryKey: ['raw-materials-for-recipe', businessId],
    queryFn: async () => {
      if (!businessId) return [];
      const { data, error } = await supabase
        .from('raw_materials')
        .select('id, name, costo_unitario, unit_purchase')
        .eq('business_id', businessId)
        .order('name');
      if (error) throw error;
      return (data || []).map((m: any) => ({
        id: m.id,
        name: m.name,
        cost_price: m.costo_unitario || 0,
        unit_of_measure: m.unit_purchase || 'pieza',
        _isRawMaterial: true,
      }));
    },
    enabled: open && !!businessId,
  });

  // Also fetch products with tipo='ingrediente' (legacy support)
  const { products } = useProducts();
  const productIngredients = products.filter(p => (p as any).tipo === 'ingrediente').map(p => ({
    id: p.id,
    name: p.name,
    cost_price: p.cost_price,
    unit_of_measure: p.unit_of_measure,
    _isRawMaterial: false,
  }));

  const ingredients = [...(rawMaterials || []), ...productIngredients];

  // Fetch or create recipe
  const { data: recipe, isLoading: recipeLoading } = useQuery({
    queryKey: ['recipe', product.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('product_id', product.id)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch recipe ingredients - manual join since FK was dropped
  const { data: recipeIngredients, isLoading: ingredientsLoading } = useQuery({
    queryKey: ['recipe-ingredients', recipe?.id],
    queryFn: async () => {
      if (!recipe?.id) return [];
      const { data, error } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .eq('recipe_id', recipe.id);
      if (error) throw error;

      // Enrich with ingredient info from products or raw_materials
      const enriched = await Promise.all((data || []).map(async (ri: any) => {
        let ingredient = null;
        if (ri.is_raw_material) {
          const { data: mat } = await supabase.from('raw_materials').select('id, name, costo_unitario, unit_purchase').eq('id', ri.ingredient_id).maybeSingle();
          if (mat) ingredient = { id: mat.id, name: mat.name, cost_price: (mat as any).costo_unitario || 0, unit_of_measure: (mat as any).unit_purchase || 'pieza' };
        } else {
          const { data: prod } = await supabase.from('products').select('id, name, cost_price, unit_of_measure').eq('id', ri.ingredient_id).maybeSingle();
          if (prod) ingredient = prod;
        }
        return { ...ri, ingredient } as unknown as RecipeIngredient;
      }));

      return enriched;
    },
    enabled: !!recipe?.id,
  });

  const createRecipe = useMutation({
    mutationFn: async () => {
      if (!businessId) throw new Error('No business');
      const { data, error } = await supabase
        .from('recipes')
        .insert({ business_id: businessId, product_id: product.id, name: `Ficha de costo: ${product.name}` })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe', product.id] });
      toast({ title: 'Ficha de costo creada' });
    },
  });

  const updateYield = useMutation({
    mutationFn: async (yieldQty: number) => {
      if (!recipe?.id) return;
      const { error } = await supabase
        .from('recipes')
        .update({ yield_quantity: yieldQty })
        .eq('id', recipe.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recipe', product.id] }),
  });

  const addIngredient = useMutation({
    mutationFn: async ({ ingredientId, quantity, unit, ingredientType, gramaje, isRawMaterial }: { ingredientId: string; quantity: number; unit: string; ingredientType: 'base' | 'agrego'; gramaje: number; isRawMaterial: boolean }) => {
      if (!recipe?.id) throw new Error('No recipe');
      const { error } = await supabase
        .from('recipe_ingredients')
        .insert({ recipe_id: recipe.id, ingredient_id: ingredientId, quantity, unit, ingredient_type: ingredientType, gramaje, is_raw_material: isRawMaterial } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-ingredients', recipe?.id] });
      toast({ title: 'Ingrediente agregado' });
    },
  });

  const removeIngredient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('recipe_ingredients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-ingredients', recipe?.id] });
    },
  });

  const updateSurcharge = useMutation({
    mutationFn: async ({ id, surcharge }: { id: string; surcharge: number }) => {
      const { error } = await supabase.from('recipe_ingredients').update({ surcharge }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-ingredients', recipe?.id] });
      toast({ title: 'Precio de agrego actualizado' });
    },
  });

  const updateIngredient = useMutation({
    mutationFn: async ({ id, quantity, unit }: { id: string; quantity: number; unit: string }) => {
      const { error } = await supabase.from('recipe_ingredients').update({ quantity, unit }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe-ingredients', recipe?.id] });
      toast({ title: 'Ingrediente actualizado' });
      setEditingId(null);
    },
  });

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editUnit, setEditUnit] = useState('');

  const startEdit = (ri: RecipeIngredient) => {
    setEditingId(ri.id);
    setEditQty(String(ri.quantity));
    setEditUnit(ri.unit || ri.ingredient?.unit_of_measure || 'pieza');
  };

  const confirmEdit = () => {
    if (!editingId || !editQty) return;
    updateIngredient.mutate({ id: editingId, quantity: Number(editQty), unit: editUnit });
  };

  // Add ingredient form state
  const [newIngredientId, setNewIngredientId] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newType, setNewType] = useState<'base' | 'agrego'>('base');
  const [newGramaje, setNewGramaje] = useState('');
  

  const handleIngredientChange = (ingredientId: string) => {
    setNewIngredientId(ingredientId);
    const ing = ingredients.find(i => i.id === ingredientId);
    if (ing) {
      const baseUnit = ing.unit_of_measure || 'pieza';
      const normalized = normalizeUnitKey(baseUnit);
      setNewUnit(normalized);
    }
  };

  const handleAddIngredient = () => {
    if (newType === 'agrego') {
      if (!newIngredientId || !newGramaje) return;
    } else {
      if (!newIngredientId || !newQuantity) return;
    }

    const ing = ingredients.find(i => i.id === newIngredientId);
    const purchaseUnitRaw = ing?.unit_of_measure || 'pieza';
    const purchaseUnit = normalizeUnitKey(purchaseUnitRaw);
    const unit = normalizeUnitKey(newUnit || purchaseUnit);

    const qty = newType === 'agrego' ? Number(newGramaje) : Number(newQuantity);

    // For agregos we keep `quantity/unit` as entered, and store `gramaje` as the
    // quantity converted to the ingredient stock unit (unit_of_measure) per unidad vendida.
    let gramaje = 0;
    if (newType === 'agrego') {
      const converted = convertUnits(qty, unit, purchaseUnit);
      gramaje = converted ?? qty;
    }

    const isRawMaterial = ing?._isRawMaterial ?? false;

    addIngredient.mutate({
      ingredientId: newIngredientId,
      quantity: qty,
      unit: unit || 'pieza',
      ingredientType: newType,
      gramaje,
      isRawMaterial,
    });

    setNewIngredientId('');
    setNewQuantity('');
    setNewUnit('');
    setNewType('base');
    setNewGramaje('');
    
  };

  // Calculate ingredient cost using unit conversion
  const calcCostForIngredient = (ri: RecipeIngredient): number => {
    const ing = ri.ingredient;
    if (!ing) return 0;
    const costPerUnit = Number(ing.cost_price);
    const purchaseUnit = ing.unit_of_measure || 'pieza';
    return calcIngredientCost(ri.quantity, ri.unit || purchaseUnit, costPerUnit, purchaseUnit);
  };

  // Calculate recipe cost (only base ingredients)
  const baseIngredients = (recipeIngredients || []).filter(ri => ri.ingredient_type === 'base');
  const agregoIngredients = (recipeIngredients || []).filter(ri => ri.ingredient_type === 'agrego');

  const recipeCost = baseIngredients.reduce((sum, ri) => sum + calcCostForIngredient(ri), 0);
  const yieldQty = recipe?.yield_quantity || 1;
  const costPerUnit = recipeCost / yieldQty;
  const salePrice = Number(product.sale_price);
  const margin = salePrice > 0 ? ((salePrice - costPerUnit) / salePrice * 100) : 0;

  // Fetch last freight cost from product_stock_entries
  const { data: lastFreight } = useQuery({
    queryKey: ['last-freight', product.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('product_stock_entries')
        .select('freight_cost')
        .eq('product_id', product.id)
        .not('freight_cost', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data?.freight_cost ?? 0;
    },
    enabled: open && !!recipe,
  });

  const [adjustedCostState, setAdjustedCostState] = useState<number | null>(null);

  const isLoading = recipeLoading || ingredientsLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            Ficha de costo: {product.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !recipe ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">Este producto aún no tiene ficha de costo.</p>
              <Button onClick={() => createRecipe.mutate()} disabled={createRecipe.isPending}>
                {createRecipe.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear ficha de costo
              </Button>
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

              {/* Cost summary */}
              <div className="grid grid-cols-3 gap-2">
                <Card className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Costo ficha</p>
                  <p className="text-lg font-bold">${recipeCost.toFixed(2)}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Costo/unidad</p>
                  <p className="text-lg font-bold">${costPerUnit.toFixed(2)}</p>
                </Card>
                <Card className="p-3 text-center">
                  <p className="text-xs text-muted-foreground">Margen</p>
                  <p className={`text-lg font-bold ${margin >= 30 ? 'text-green-600' : margin >= 10 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {margin.toFixed(1)}%
                  </p>
                </Card>
              </div>

              <Separator />

              {/* Base ingredients */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Ingredientes base <Badge variant="secondary" className="text-[10px] ml-1">Siempre se consumen</Badge></p>
                {baseIngredients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin ingredientes base.</p>
                ) : (
                  <div className="space-y-1.5">
                    {baseIngredients.map((ri) => {
                      const cost = calcCostForIngredient(ri);
                      const purchaseUnit = ri.ingredient?.unit_of_measure || 'pieza';
                      const showConversion = ri.unit && ri.unit !== purchaseUnit && getUnitCategory(ri.unit) !== 'unit';
                      const isEditing = editingId === ri.id;
                      return (
                        <div key={ri.id} className="flex items-center justify-between rounded-md border p-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{ri.ingredient?.name || 'Desconocido'}</p>
                            {isEditing ? (
                              <div className="flex items-center gap-1.5 mt-1">
                                <Input type="number" min={0.01} step={0.01} className="w-20 h-7 text-xs" value={editQty} onChange={(e) => setEditQty(e.target.value)} />
                                <select value={editUnit} onChange={(e) => setEditUnit(e.target.value)} className="h-7 rounded-md border border-input bg-background px-1.5 text-xs">
                                  {getAllUnits().map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                                </select>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {ri.quantity} {ri.unit}
                                {showConversion && (
                                  <span className="text-muted-foreground/60"> (compra en {purchaseUnit})</span>
                                )}
                                {' · '}
                                <span className="font-medium text-foreground">${cost.toFixed(2)}</span>
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-0.5 flex-shrink-0">
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
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => startEdit(ri)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeIngredient.mutate(ri.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Agrego ingredients */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Agregos <Badge variant="outline" className="text-[10px] ml-1">Opcionales al vender</Badge></p>
                {agregoIngredients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin agregos configurados.</p>
                ) : (
                  <div className="space-y-1.5">
                    {agregoIngredients.map((ri) => {
                      const cost = calcCostForIngredient(ri);
                      const purchaseUnit = ri.ingredient?.unit_of_measure || 'pieza';
                      const showConversion = ri.unit && ri.unit !== purchaseUnit && getUnitCategory(ri.unit) !== 'unit';
                      const isEditing = editingId === ri.id;
                      return (
                        <div key={ri.id} className="flex items-center justify-between rounded-md border border-dashed p-2 gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{ri.ingredient?.name || 'Desconocido'}</p>
                            {isEditing ? (
                              <div className="flex items-center gap-1.5 mt-1">
                                <Input type="number" min={0.01} step={0.01} className="w-20 h-7 text-xs" value={editQty} onChange={(e) => setEditQty(e.target.value)} />
                                <select value={editUnit} onChange={(e) => setEditUnit(e.target.value)} className="h-7 rounded-md border border-input bg-background px-1.5 text-xs">
                                  {getAllUnits().map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                                </select>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                {ri.quantity} {ri.unit} por unidad vendida
                                {showConversion && (
                                  <span className="text-muted-foreground/60"> (consume {ri.gramaje} {purchaseUnit})</span>
                                )}
                                {' · '}
                                <span className="font-medium text-foreground">${cost.toFixed(2)} costo</span>
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {!isEditing && (
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-muted-foreground">+$</span>
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.5}
                                  className="w-16 h-7 text-xs text-center"
                                  defaultValue={(ri as any).surcharge || 0}
                                  onBlur={(e) => {
                                    const v = Number(e.target.value);
                                    if (v !== ((ri as any).surcharge || 0)) {
                                      updateSurcharge.mutate({ id: ri.id, surcharge: v });
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
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => startEdit(ri)}>
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeIngredient.mutate(ri.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Separator />

              {/* Add ingredient */}
              <div className="space-y-2">
                <p className="text-sm font-semibold">Agregar ingrediente</p>
                {ingredients.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No hay productos tipo "ingrediente". Crea uno primero en Inventario.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={newIngredientId}
                        onChange={(e) => handleIngredientChange(e.target.value)}
                        className="flex h-10 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Seleccionar...</option>
                        {ingredients.map(i => (
                          <option key={i.id} value={i.id}>{i.name} ({i.unit_of_measure})</option>
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
                      {/* Unit selector – all system units */}
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
                        onClick={handleAddIngredient}
                        disabled={!newIngredientId || (newType === 'agrego' ? !newGramaje : !newQuantity) || addIngredient.isPending}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Conversion hint */}
                    {(() => {
                      const ing = ingredients.find(i => i.id === newIngredientId);
                      if (!ing) return null;
                      const purchaseUnit = normalizeUnitKey(ing.unit_of_measure || 'pieza');
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
            </>
          )}
        </div>

        {/* Footer */}
        {recipe && (
          <div className="flex-shrink-0 pt-3 border-t">
            <Button className="w-full" onClick={() => onOpenChange(false)}>
              Guardar y cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
