import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { convertUnits } from '@/lib/unitConversion';

interface BottleneckInfo {
  maxUnits: number;
  bottleneck: { name: string; available: number; needed: number; unit: string } | null;
  breakdown: { name: string; maxUnits: number; available: number; needed: number; unit: string }[];
}

export const useProductionCapacity = (productId: string | null, branchId: string | undefined) => {
  return useQuery({
    queryKey: ['production-capacity', productId, branchId],
    queryFn: async (): Promise<BottleneckInfo> => {
      if (!productId || !branchId) return { maxUnits: 0, bottleneck: null, breakdown: [] };

      // Get active recipe
      const { data: recipe } = await supabase
        .from('recipes')
        .select('id, yield_quantity')
        .eq('product_id', productId)
        .eq('is_active', true)
        .maybeSingle();

      if (!recipe) return { maxUnits: 0, bottleneck: null, breakdown: [] };

      // Get base ingredients
      const { data: ingredients } = await supabase
        .from('recipe_ingredients')
        .select('*, ingredient:products!recipe_ingredients_ingredient_id_fkey(id, name, unit_of_measure)')
        .eq('recipe_id', recipe.id)
        .eq('ingredient_type', 'base');

      if (!ingredients || ingredients.length === 0) return { maxUnits: Infinity, bottleneck: null, breakdown: [] };

      // Get stock for all ingredient products in this branch
      const ingredientIds = ingredients.map(i => i.ingredient_id);
      const { data: stocks } = await supabase
        .from('branch_stock')
        .select('product_id, quantity')
        .eq('branch_id', branchId)
        .in('product_id', ingredientIds);

      const stockMap = new Map((stocks || []).map(s => [s.product_id, s.quantity]));
      const yieldQty = recipe.yield_quantity || 1;

      const breakdown: BottleneckInfo['breakdown'] = [];

      for (const ri of ingredients as any[]) {
        const available = stockMap.get(ri.ingredient_id) || 0;
        const neededPerBatch = ri.quantity; // quantity per recipe batch
        const purchaseUnit = ri.ingredient?.unit_of_measure || 'pieza';

        // Convert recipe unit to purchase unit for stock comparison
        let neededInStockUnit = neededPerBatch;
        if (ri.unit && ri.unit !== purchaseUnit) {
          const converted = convertUnits(neededPerBatch, ri.unit, purchaseUnit);
          if (converted !== null) neededInStockUnit = converted;
        }

        const maxFromThis = neededInStockUnit > 0
          ? Math.floor((available / neededInStockUnit) * yieldQty)
          : Infinity;

        breakdown.push({
          name: ri.ingredient?.name || 'Desconocido',
          maxUnits: maxFromThis,
          available,
          needed: neededInStockUnit,
          unit: purchaseUnit,
        });
      }

      const minItem = breakdown.reduce((min, item) =>
        item.maxUnits < min.maxUnits ? item : min, breakdown[0]);

      return {
        maxUnits: minItem?.maxUnits ?? 0,
        bottleneck: minItem && minItem.maxUnits < Infinity ? {
          name: minItem.name,
          available: minItem.available,
          needed: minItem.needed,
          unit: minItem.unit,
        } : null,
        breakdown,
      };
    },
    enabled: !!productId && !!branchId,
    refetchInterval: 5000, // Refresh every 5s
  });
};
