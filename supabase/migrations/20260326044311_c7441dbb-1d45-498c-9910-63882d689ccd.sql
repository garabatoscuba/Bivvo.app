
-- Add recipe_id to service_categories
ALTER TABLE public.service_categories
ADD COLUMN recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL DEFAULT NULL;

-- Create trigger function to deduct ingredients when a service entry is created
-- for a category that has a recipe_id
CREATE OR REPLACE FUNCTION public.deduct_service_recipe_ingredients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _recipe_id uuid;
  _recipe RECORD;
  _ingredient RECORD;
  _deduct_qty NUMERIC;
  _stock_unit TEXT;
BEGIN
  -- Only process if category_id is set
  IF NEW.category_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if category has a recipe
  SELECT recipe_id INTO _recipe_id
  FROM public.service_categories
  WHERE id = NEW.category_id;

  IF _recipe_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get recipe details
  SELECT id, yield_quantity INTO _recipe
  FROM public.recipes
  WHERE id = _recipe_id AND is_active = true;

  IF _recipe IS NULL THEN
    RETURN NEW;
  END IF;

  -- Deduct each base ingredient
  FOR _ingredient IN
    SELECT ri.ingredient_id, ri.quantity, ri.unit, ri.is_raw_material,
           p.unit_of_measure
    FROM public.recipe_ingredients ri
    LEFT JOIN public.products p ON p.id = ri.ingredient_id AND NOT ri.is_raw_material
    LEFT JOIN public.raw_materials rm ON rm.id = ri.ingredient_id AND ri.is_raw_material
    WHERE ri.recipe_id = _recipe.id AND ri.ingredient_type = 'base'
  LOOP
    _deduct_qty := _ingredient.quantity / COALESCE(_recipe.yield_quantity, 1);

    -- Convert units if needed
    IF NOT _ingredient.is_raw_material AND _ingredient.unit IS NOT NULL AND _ingredient.unit != '' AND _ingredient.unit_of_measure IS NOT NULL THEN
      _deduct_qty := public.convert_recipe_units(_deduct_qty, _ingredient.unit, _ingredient.unit_of_measure);
    END IF;

    IF _deduct_qty <= 0 THEN CONTINUE; END IF;

    IF _ingredient.is_raw_material THEN
      -- Deduct from raw_materials stock
      UPDATE public.raw_materials
      SET stock_vendedor = GREATEST(0, stock_vendedor - _deduct_qty),
          updated_at = now()
      WHERE id = _ingredient.ingredient_id;
    ELSE
      -- Deduct from branch_stock
      UPDATE public.branch_stock
      SET quantity = GREATEST(0, quantity - _deduct_qty),
          updated_at = now()
      WHERE branch_id = NEW.branch_id AND product_id = _ingredient.ingredient_id;
    END IF;

    -- Log inventory movement
    INSERT INTO public.inventory_movements (branch_id, product_id, user_id, movement_type, quantity, notes)
    VALUES (NEW.branch_id, _ingredient.ingredient_id, NEW.user_id, 'sale', _deduct_qty, 'Auto: servicio con ficha de costo');
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger on service_entries
CREATE TRIGGER trg_deduct_service_recipe
AFTER INSERT ON public.service_entries
FOR EACH ROW
EXECUTE FUNCTION public.deduct_service_recipe_ingredients();
