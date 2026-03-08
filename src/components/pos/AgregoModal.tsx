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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import type { Product, Category } from '@/types/database';

interface AgregoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: (Product & { category: Category | null }) | null;
  onConfirm: (selectedAgregoIds: string[]) => void;
}

interface AgregoItem {
  id: string;
  ingredient_id: string;
  gramaje: number;
  ingredient?: { id: string; name: string; cost_price: number };
}

export const AgregoModal = ({ open, onOpenChange, product, onConfirm }: AgregoModalProps) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Fetch agregos for this product's active recipe
  const { data: agregos, isLoading } = useQuery({
    queryKey: ['product-agregos', product?.id],
    queryFn: async () => {
      if (!product?.id) return [];
      // Get active recipe
      const { data: recipe } = await supabase
        .from('recipes')
        .select('id')
        .eq('product_id', product.id)
        .eq('is_active', true)
        .maybeSingle();
      if (!recipe) return [];

      const { data, error } = await supabase
        .from('recipe_ingredients')
        .select('id, ingredient_id, gramaje, ingredient:products!recipe_ingredients_ingredient_id_fkey(id, name, cost_price)')
        .eq('recipe_id', recipe.id)
        .eq('ingredient_type', 'agrego');
      if (error) throw error;
      return (data || []) as unknown as AgregoItem[];
    },
    enabled: open && !!product?.id,
  });

  useEffect(() => {
    if (open) setSelected(new Set());
  }, [open]);

  const toggleAgrego = (ingredientId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ingredientId)) next.delete(ingredientId);
      else next.add(ingredientId);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selected));
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
            agregos.map((agrego) => (
              <div
                key={agrego.id}
                className="flex items-center gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/50"
                onClick={() => toggleAgrego(agrego.ingredient_id)}
              >
                <Checkbox
                  checked={selected.has(agrego.ingredient_id)}
                  onCheckedChange={() => toggleAgrego(agrego.ingredient_id)}
                />
                <div className="flex-1 min-w-0">
                  <Label className="text-sm font-medium cursor-pointer">
                    {agrego.ingredient?.name || 'Ingrediente'}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {agrego.gramaje > 0 ? `${agrego.gramaje} por unidad` : ''}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onConfirm([]); onOpenChange(false); }}>
            Sin agregos
          </Button>
          <Button onClick={handleConfirm}>
            Confirmar {selected.size > 0 ? `(${selected.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
