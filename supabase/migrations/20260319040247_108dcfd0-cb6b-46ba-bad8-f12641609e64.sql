
-- 1. Add resulting_avg_cost to product_stock_entries for purchase history display
ALTER TABLE public.product_stock_entries ADD COLUMN IF NOT EXISTS resulting_avg_cost numeric;

-- 2. Replace the ingredient-only trigger with one that handles ALL product types
CREATE OR REPLACE FUNCTION public.update_ingredient_weighted_cost()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _product RECORD;
  _total_stock NUMERIC;
  _new_cost NUMERIC;
  _avg_cost NUMERIC;
BEGIN
  IF NEW.unit_cost IS NULL OR NEW.unit_cost <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT tipo, cost_price INTO _product
  FROM public.products
  WHERE id = NEW.product_id;

  IF _product IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip elaborado and granel (their cost is derived from recipes)
  IF _product.tipo IN ('elaborado', 'granel') THEN
    RETURN NEW;
  END IF;

  -- Calculate total existing stock across all branches
  SELECT COALESCE(SUM(quantity + warehouse_quantity), 0) INTO _total_stock
  FROM public.branch_stock
  WHERE product_id = NEW.product_id;

  -- Subtract the newly added quantity (it was already added to branch_stock before this trigger)
  _total_stock := _total_stock - NEW.quantity;
  IF _total_stock < 0 THEN _total_stock := 0; END IF;

  -- Weighted average cost
  IF _total_stock + NEW.quantity > 0 THEN
    _avg_cost := ((_total_stock * COALESCE(_product.cost_price, 0)) + (NEW.quantity * NEW.unit_cost)) / (_total_stock + NEW.quantity);
  ELSE
    _avg_cost := NEW.unit_cost;
  END IF;

  -- Update product cost_price
  UPDATE public.products
  SET cost_price = ROUND(_avg_cost, 4), updated_at = now()
  WHERE id = NEW.product_id;

  -- Store the resulting average cost in the entry record
  UPDATE public.product_stock_entries
  SET resulting_avg_cost = ROUND(_avg_cost, 4)
  WHERE id = NEW.id;

  RETURN NEW;
END;
$function$;

-- 3. Create function to recalculate elaborado/granel cost_price based on recipe ingredient costs
CREATE OR REPLACE FUNCTION public.recalculate_recipe_product_cost()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _recipe RECORD;
  _total_cost NUMERIC;
  _ingredient RECORD;
  _ing_cost NUMERIC;
  _needed_in_stock_unit NUMERIC;
BEGIN
  -- Only fire when cost_price actually changed
  IF NEW.cost_price IS NOT DISTINCT FROM OLD.cost_price THEN
    RETURN NEW;
  END IF;

  -- Find all elaborado/granel products that use this product as ingredient
  FOR _recipe IN
    SELECT DISTINCT r.id as recipe_id, r.product_id, r.yield_quantity
    FROM public.recipes r
    JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
    WHERE ri.ingredient_id = NEW.id
      AND ri.ingredient_type = 'base'
      AND r.is_active = true
      AND EXISTS (
        SELECT 1 FROM public.products p 
        WHERE p.id = r.product_id AND p.tipo IN ('elaborado', 'granel')
      )
  LOOP
    _total_cost := 0;

    -- Sum cost of all base ingredients for this recipe
    FOR _ingredient IN
      SELECT ri.ingredient_id, ri.quantity, ri.unit, ri.is_raw_material,
             p.cost_price as product_cost, p.unit_of_measure,
             rm.costo_unitario as raw_cost
      FROM public.recipe_ingredients ri
      LEFT JOIN public.products p ON p.id = ri.ingredient_id AND NOT ri.is_raw_material
      LEFT JOIN public.raw_materials rm ON rm.id = ri.ingredient_id AND ri.is_raw_material
      WHERE ri.recipe_id = _recipe.recipe_id AND ri.ingredient_type = 'base'
    LOOP
      IF _ingredient.is_raw_material THEN
        _ing_cost := COALESCE(_ingredient.raw_cost, 0);
      ELSE
        _ing_cost := COALESCE(_ingredient.product_cost, 0);
      END IF;

      _needed_in_stock_unit := _ingredient.quantity;
      IF _ingredient.unit IS NOT NULL AND _ingredient.unit != '' AND _ingredient.unit_of_measure IS NOT NULL THEN
        _needed_in_stock_unit := public.convert_recipe_units(_ingredient.quantity, _ingredient.unit, _ingredient.unit_of_measure);
      END IF;

      _total_cost := _total_cost + (_needed_in_stock_unit * _ing_cost);
    END LOOP;

    -- Divide by yield to get per-unit cost
    IF COALESCE(_recipe.yield_quantity, 1) > 0 THEN
      _total_cost := _total_cost / _recipe.yield_quantity;
    END IF;

    -- Update the elaborado/granel product cost_price
    UPDATE public.products
    SET cost_price = ROUND(_total_cost, 4), updated_at = now()
    WHERE id = _recipe.product_id;
  END LOOP;

  RETURN NEW;
END;
$function$;

-- 4. Create trigger on products for recipe cost recalculation
DROP TRIGGER IF EXISTS trg_recalculate_recipe_cost ON public.products;
CREATE TRIGGER trg_recalculate_recipe_cost
  AFTER UPDATE OF cost_price ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_recipe_product_cost();

-- 5. Similar trigger for raw_materials cost changes
CREATE OR REPLACE FUNCTION public.recalculate_recipe_from_raw_material_cost()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _recipe RECORD;
  _total_cost NUMERIC;
  _ingredient RECORD;
  _ing_cost NUMERIC;
  _needed_in_stock_unit NUMERIC;
BEGIN
  IF NEW.costo_unitario IS NOT DISTINCT FROM OLD.costo_unitario THEN
    RETURN NEW;
  END IF;

  FOR _recipe IN
    SELECT DISTINCT r.id as recipe_id, r.product_id, r.yield_quantity
    FROM public.recipes r
    JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
    WHERE ri.ingredient_id = NEW.id
      AND ri.is_raw_material = true
      AND ri.ingredient_type = 'base'
      AND r.is_active = true
      AND EXISTS (
        SELECT 1 FROM public.products p 
        WHERE p.id = r.product_id AND p.tipo IN ('elaborado', 'granel')
      )
  LOOP
    _total_cost := 0;

    FOR _ingredient IN
      SELECT ri.ingredient_id, ri.quantity, ri.unit, ri.is_raw_material,
             p.cost_price as product_cost, p.unit_of_measure,
             rm.costo_unitario as raw_cost
      FROM public.recipe_ingredients ri
      LEFT JOIN public.products p ON p.id = ri.ingredient_id AND NOT ri.is_raw_material
      LEFT JOIN public.raw_materials rm ON rm.id = ri.ingredient_id AND ri.is_raw_material
      WHERE ri.recipe_id = _recipe.recipe_id AND ri.ingredient_type = 'base'
    LOOP
      IF _ingredient.is_raw_material THEN
        _ing_cost := COALESCE(_ingredient.raw_cost, 0);
      ELSE
        _ing_cost := COALESCE(_ingredient.product_cost, 0);
      END IF;

      _needed_in_stock_unit := _ingredient.quantity;
      IF _ingredient.unit IS NOT NULL AND _ingredient.unit != '' AND _ingredient.unit_of_measure IS NOT NULL THEN
        _needed_in_stock_unit := public.convert_recipe_units(_ingredient.quantity, _ingredient.unit, _ingredient.unit_of_measure);
      END IF;

      _total_cost := _total_cost + (_needed_in_stock_unit * _ing_cost);
    END LOOP;

    IF COALESCE(_recipe.yield_quantity, 1) > 0 THEN
      _total_cost := _total_cost / _recipe.yield_quantity;
    END IF;

    UPDATE public.products
    SET cost_price = ROUND(_total_cost, 4), updated_at = now()
    WHERE id = _recipe.product_id;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_recalculate_recipe_from_raw_material ON public.raw_materials;
CREATE TRIGGER trg_recalculate_recipe_from_raw_material
  AFTER UPDATE OF costo_unitario ON public.raw_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_recipe_from_raw_material_cost();
