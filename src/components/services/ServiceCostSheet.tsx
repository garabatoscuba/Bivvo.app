import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Loader2, ClipboardList } from 'lucide-react';

const UNITS = ['g', 'kg', 'lb', 'oz', 'ml', 'l', 'pieza', 'unidad'];

interface Props {
  categoryId: string;
  categoryName: string;
  businessId: string;
  fixedPrice?: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ServiceCostSheet({ categoryId, categoryName, businessId, fixedPrice, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addMaterialId, setAddMaterialId] = useState('');
  const [addQuantity, setAddQuantity] = useState('1');
  const [addUnit, setAddUnit] = useState('pieza');

  // Fetch ingredients for this category
  const { data: ingredients = [], isLoading } = useQuery({
    queryKey: ['service-cost-ingredients', categoryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_cost_ingredients' as any)
        .select('*, raw_materials(id, name, costo_unitario, unit_use)')
        .eq('category_id', categoryId)
        .order('created_at');
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!categoryId && open,
  });

  // Fetch available raw materials for the business
  const { data: materials = [] } = useQuery({
    queryKey: ['raw-materials-for-service', businessId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raw_materials')
        .select('id, name, costo_unitario, unit_use, insumo_areas(name)')
        .eq('business_id', businessId)
        .order('name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!businessId && open,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('service_cost_ingredients' as any).insert({
        category_id: categoryId,
        material_id: addMaterialId,
        quantity: parseFloat(addQuantity) || 1,
        unit: addUnit,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-cost-ingredients', categoryId] });
      queryClient.invalidateQueries({ queryKey: ['service-cost-summary'] });
      setAddMaterialId('');
      setAddQuantity('1');
      setAddUnit('pieza');
      toast({ title: 'Insumo agregado' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('service_cost_ingredients' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['service-cost-ingredients', categoryId] });
      queryClient.invalidateQueries({ queryKey: ['service-cost-summary'] });
      toast({ title: 'Insumo eliminado' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // Calculate total cost
  const totalCost = ingredients.reduce((sum: number, ing: any) => {
    const unitCost = Number(ing.raw_materials?.costo_unitario) || 0;
    return sum + (Number(ing.quantity) * unitCost);
  }, 0);

  const price = fixedPrice != null ? Number(fixedPrice) : 0;
  const margin = price > 0 ? ((price - totalCost) / price * 100) : null;

  // Filter out already-added materials
  const addedMaterialIds = new Set(ingredients.map((i: any) => i.material_id));
  const availableMaterials = materials.filter((m: any) => !addedMaterialIds.has(m.id));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Ficha de costo: {categoryName}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Cost summary */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Costo total</span>
              <span className="font-bold">${totalCost.toFixed(2)}</span>
            </div>
            {price > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Precio de venta</span>
                  <span className="font-medium">${price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Margen</span>
                  <span className={`font-bold ${margin != null && margin >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {margin != null ? `${margin.toFixed(1)}%` : '—'}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Ingredients list */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Insumos</Label>
            {isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : ingredients.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Sin insumos. Agrega los que consume este servicio.</p>
            ) : (
              <div className="space-y-1.5 mt-2">
                {ingredients.map((ing: any) => {
                  const mat = ing.raw_materials;
                  const lineCost = Number(ing.quantity) * (Number(mat?.costo_unitario) || 0);
                  return (
                    <div key={ing.id} className="flex items-center justify-between rounded-md border px-3 py-2 group">
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium">{mat?.name || 'Insumo'}</span>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{ing.quantity} {ing.unit || mat?.unit_use || 'ud'}</span>
                          <span>× ${(Number(mat?.costo_unitario) || 0).toFixed(2)}</span>
                          <span className="font-medium text-foreground">= ${lineCost.toFixed(2)}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive shrink-0"
                        onClick={() => deleteMutation.mutate(ing.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add new ingredient */}
          <div className="space-y-2 border-t pt-4">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Agregar insumo</Label>
            <Select value={addMaterialId} onValueChange={setAddMaterialId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar insumo..." /></SelectTrigger>
              <SelectContent>
                {availableMaterials.map((m: any) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} {(m as any).insumo_areas?.name ? `(${(m as any).insumo_areas.name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={addQuantity}
                  onChange={e => setAddQuantity(e.target.value)}
                  placeholder="Cantidad"
                />
              </div>
              <Select value={addUnit} onValueChange={setAddUnit}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNITS.map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              className="w-full"
              disabled={!addMaterialId || !addQuantity || Number(addQuantity) <= 0 || addMutation.isPending}
              onClick={() => addMutation.mutate()}
            >
              {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Agregar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
