import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { convertUnits } from '@/lib/unitConversion';

interface BottleneckInfo {
  maxUnits: number;
  bottleneck: { name: string; available: number; needed: number; unit: string } | null;
  breakdown: { name: string; maxUnits: number; available: number; needed: number; unit: string }[];
}

export const useProductionCapacity = (productId: string | null, branchId: string | undefined, options?: { onlySellerStock?: boolean }) => {
  const onlySellerStock = options?.onlySellerStock ?? false;
  return useQuery({
    queryKey: ['production-capacity', productId, branchId, onlySellerStock],
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
      const { data: riData } = await supabase
        .from('recipe_ingredients')
        .select('*')
        .eq('recipe_id', recipe.id)
        .eq('ingredient_type', 'base');

      // Enrich with product/raw_material info
      const ingredients = await Promise.all((riData || []).map(async (ri: any) => {
        let ingredient = null;
        if (ri.is_raw_material) {
          const { data } = await supabase.from('raw_materials').select('id, name, unit_purchase').eq('id', ri.ingredient_id).maybeSingle();
          if (data) ingredient = { id: data.id, name: data.name, unit_of_measure: (data as any).unit_purchase || 'pieza' };
        } else {
          const { data } = await supabase.from('products').select('id, name, unit_of_measure').eq('id', ri.ingredient_id).maybeSingle();
          if (data) ingredient = data;
        }
        return { ...ri, ingredient };
      }));

      if (!ingredients || ingredients.length === 0) return { maxUnits: Infinity, bottleneck: null, breakdown: [] };

      // Get stock for ingredients from appropriate tables
      const stockMap = new Map<string, number>();
      const prodIds = ingredients.filter((i: any) => !i.is_raw_material).map((i: any) => i.ingredient_id);
      const matIds = ingredients.filter((i: any) => i.is_raw_material).map((i: any) => i.ingredient_id);

      if (prodIds.length > 0) {
        const { data: stocks } = await supabase
          .from('branch_stock')
          .select('product_id, quantity')
          .eq('branch_id', branchId)
          .in('product_id', prodIds);
        for (const s of (stocks || [])) stockMap.set(s.product_id, s.quantity);
      }
      if (matIds.length > 0) {
        const { data: mats } = await supabase
          .from('raw_materials')
          .select('id, stock_vendedor, stock_almacen')
          .in('id', matIds);
        for (const m of (mats || [])) stockMap.set(m.id, ((m as any).stock_vendedor || 0) + ((m as any).stock_almacen || 0));
      }
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
