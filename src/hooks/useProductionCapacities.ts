import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { convertUnits } from '@/lib/unitConversion';

type CapacityMap = Record<string, number>; // product_id -> maxUnits (finite)

interface RecipeRow {
  id: string;
  product_id: string;
  yield_quantity: number | null;
}

interface IngredientRow {
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
  unit: string | null;
  ingredient?: {
    id: string;
    unit_of_measure: string | null;
  } | null;
}

/**
 * Calcula en batch la producción posible (solo ingredientes base) para múltiples productos elaborados.
 * Devuelve SOLO valores finitos; si no hay receta o la capacidad es infinita, no incluye el producto en el map.
 */
export const useProductionCapacities = (productIds: string[], branchId: string | undefined, options?: { granelIds?: Set<string> }) => {
  const granelIds = options?.granelIds;
  const granelKey = granelIds ? Array.from(granelIds).sort().join(',') : '';
  return useQuery({
    queryKey: ['production-capacities', branchId, productIds.slice().sort().join(','), granelKey],
    queryFn: async (): Promise<CapacityMap> => {
      if (!branchId || productIds.length === 0) return {};

      // Active recipes for these products
      const { data: recipes, error: recipesError } = await supabase
        .from('recipes')
        .select('id, product_id, yield_quantity')
        .in('product_id', productIds)
        .eq('is_active', true);

      if (recipesError) throw recipesError;
      if (!recipes || recipes.length === 0) return {};

      const typedRecipes = recipes as RecipeRow[];
      const recipeIds = typedRecipes.map(r => r.id);

      // Base ingredients for all recipes
      const { data: ingredients, error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .select('recipe_id, ingredient_id, quantity, unit, is_raw_material')
        .in('recipe_id', recipeIds)
        .eq('ingredient_type', 'base');

      if (ingredientsError) throw ingredientsError;

      // Separate product IDs and raw_material IDs
      const productIngredientIds = new Set<string>();
      const rawMaterialIds = new Set<string>();
      for (const ri of (ingredients || [])) {
        if ((ri as any).is_raw_material) {
          rawMaterialIds.add(ri.ingredient_id);
        } else {
          productIngredientIds.add(ri.ingredient_id);
        }
      }

      // Fetch unit_of_measure from both tables
      const unitMap = new Map<string, string>();
      if (productIngredientIds.size > 0) {
        const { data: prods } = await supabase
          .from('products')
          .select('id, unit_of_measure')
          .in('id', Array.from(productIngredientIds));
        for (const p of (prods || [])) unitMap.set(p.id, p.unit_of_measure || 'pieza');
      }
      if (rawMaterialIds.size > 0) {
        const { data: mats } = await supabase
          .from('raw_materials')
          .select('id, unit_purchase')
          .in('id', Array.from(rawMaterialIds));
        for (const m of (mats || [])) unitMap.set(m.id, (m as any).unit_purchase || 'pieza');
      }

      const typedIngredients: IngredientRow[] = (ingredients || []).map((ri: any) => ({
        recipe_id: ri.recipe_id,
        ingredient_id: ri.ingredient_id,
        quantity: ri.quantity,
        unit: ri.unit,
        ingredient: { id: ri.ingredient_id, unit_of_measure: unitMap.get(ri.ingredient_id) || 'pieza' },
      }));

      // Group ingredients by recipe
      const byRecipe = new Map<string, IngredientRow[]>();
      const ingredientIds = new Set<string>();
      for (const ri of typedIngredients) {
        ingredientIds.add(ri.ingredient_id);
        const arr = byRecipe.get(ri.recipe_id) || [];
        arr.push(ri);
        byRecipe.set(ri.recipe_id, arr);
      }

      if (ingredientIds.size === 0) return {};

      // Stock for product-type ingredients from branch_stock
      const stockMap = new Map<string, number>();

      const prodIds = Array.from(productIngredientIds).filter(id => ingredientIds.has(id));
      const matIds = Array.from(rawMaterialIds).filter(id => ingredientIds.has(id));

      if (prodIds.length > 0) {
        const { data: stocks, error: stockError } = await supabase
          .from('branch_stock')
          .select('product_id, quantity')
          .eq('branch_id', branchId)
          .in('product_id', prodIds);
        if (stockError) throw stockError;
        for (const s of (stocks || [])) stockMap.set(s.product_id, Number(s.quantity) || 0);
      }

      if (matIds.length > 0) {
        const { data: mats } = await supabase
          .from('raw_materials')
          .select('id, stock_vendedor, stock_almacen')
          .in('id', matIds);
        for (const m of (mats || [])) stockMap.set(m.id, (Number((m as any).stock_vendedor) || 0) + (Number((m as any).stock_almacen) || 0));
      }

      const capacities: CapacityMap = {};

      for (const recipe of typedRecipes) {
        const yieldQty = recipe.yield_quantity || 1;
        const recipeIngredients = byRecipe.get(recipe.id) || [];

        // Sin ingredientes base (o receta vacía): capacidad indefinida → no sobreescribimos "En venta"
        if (recipeIngredients.length === 0) continue;

        let minUnits = Infinity;

        for (const ri of recipeIngredients) {
          const available = stockMap.get(ri.ingredient_id) || 0;
          const purchaseUnit = ri.ingredient?.unit_of_measure || ri.unit || 'pieza';

          let neededInStockUnit = Number(ri.quantity) || 0;
          if (ri.unit && ri.unit !== purchaseUnit) {
            const converted = convertUnits(neededInStockUnit, ri.unit, purchaseUnit);
            if (converted !== null) neededInStockUnit = converted;
          }

          const maxFromThis = neededInStockUnit > 0
            ? Math.floor((available / neededInStockUnit) * yieldQty)
            : Infinity;

          if (maxFromThis < minUnits) minUnits = maxFromThis;
        }

        if (Number.isFinite(minUnits)) {
          capacities[recipe.product_id] = Math.max(0, Number(minUnits));
        }
      }

      return capacities;
    },
    enabled: !!branchId && productIds.length > 0,
    refetchInterval: 5000,
  });
};
