import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Minus, Plus } from 'lucide-react';
import type { Product, Category, AgregoSelection } from '@/types/database';

interface AgregoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: (Product & { category: Category | null }) | null;
  onConfirm: (agregoSelections: AgregoSelection[]) => void;
}

interface AgregoItem {
  id: string;
  ingredient_id: string;
  quantity: number;
  unit: string;
  gramaje: number;
  surcharge: number;
  ingredient?: { id: string; name: string; cost_price: number; unit_of_measure: string };
}

export const AgregoModal = ({ open, onOpenChange, product, onConfirm }: AgregoModalProps) => {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());

  const { data: agregos, isLoading } = useQuery({
    queryKey: ['product-agregos', product?.id],
    queryFn: async () => {
      if (!product?.id) return [];
      const { data: recipe } = await supabase
        .from('recipes')
        .select('id')
        .eq('product_id', product.id)
        .eq('is_active', true)
        .maybeSingle();
      if (!recipe) return [];

      const { data, error } = await supabase
        .from('recipe_ingredients')
        .select('id, ingredient_id, quantity, unit, gramaje, surcharge, is_raw_material')
        .eq('recipe_id', recipe.id)
        .eq('ingredient_type', 'agrego');
      if (error) throw error;

      // Enrich with ingredient info
      const enriched = await Promise.all((data || []).map(async (ri: any) => {
        let ingredient = null;
        if (ri.is_raw_material) {
          const { data: mat } = await supabase.from('raw_materials').select('id, name, costo_unitario, unit_purchase').eq('id', ri.ingredient_id).maybeSingle();
          if (mat) ingredient = { id: mat.id, name: mat.name, cost_price: (mat as any).costo_unitario || 0, unit_of_measure: (mat as any).unit_purchase || 'pieza' };
        } else {
          const { data: prod } = await supabase.from('products').select('id, name, cost_price, unit_of_measure').eq('id', ri.ingredient_id).maybeSingle();
          if (prod) ingredient = prod;
        }
        return { ...ri, ingredient };
      }));
      return enriched as unknown as AgregoItem[];
    },
    enabled: open && !!product?.id,
  });

  useEffect(() => {
    if (open) setCounts(new Map());
  }, [open]);

  const setCount = (ingredientId: string, delta: number) => {
    setCounts((prev) => {
      const next = new Map(prev);
      const current = next.get(ingredientId) || 0;
      const newVal = Math.max(0, current + delta);
      if (newVal === 0) next.delete(ingredientId);
      else next.set(ingredientId, newVal);
      return next;
    });
  };

  const totalSurcharge = (agregos || []).reduce((sum, a) => {
    const count = counts.get(a.ingredient_id) || 0;
    return sum + (a.surcharge || 0) * count;
  }, 0);

  const handleConfirm = () => {
    const selections: AgregoSelection[] = [];
    counts.forEach((count, ingredientId) => {
      const agrego = agregos?.find(a => a.ingredient_id === ingredientId);
      if (agrego && count > 0) {
        selections.push({
          ingredientId,
          name: agrego.ingredient?.name || 'Agrego',
          surcharge: agrego.surcharge || 0,
          count,
        });
      }
    });
    onConfirm(selections);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Agregos para {product?.name}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-2">
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !agregos?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay agregos configurados.
            </p>
          ) : (
            agregos.map((agrego) => {
              const count = counts.get(agrego.ingredient_id) || 0;
              return (
                <div
                  key={agrego.id}
                  className="flex items-center gap-3 rounded-md border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {agrego.ingredient?.name || 'Ingrediente'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {agrego.surcharge > 0 ? `+$${agrego.surcharge.toFixed(2)} c/u` : 'Sin costo extra'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setCount(agrego.ingredient_id, -1)}
                      disabled={count === 0}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm font-medium">{count}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setCount(agrego.ingredient_id, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {totalSurcharge > 0 && (
          <div className="text-sm font-medium text-right text-primary px-1">
            +${totalSurcharge.toFixed(2)} por agregos
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { onConfirm([]); onOpenChange(false); }}>
            Sin agregos
          </Button>
          <Button onClick={handleConfirm}>
            Confirmar {counts.size > 0 ? `(${Array.from(counts.values()).reduce((a, b) => a + b, 0)})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
