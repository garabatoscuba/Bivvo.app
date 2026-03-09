-- Function to calculate and update stock for elaborado products
CREATE OR REPLACE FUNCTION public.recalculate_elaborado_stock(_elaborado_id uuid, _branch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _recipe RECORD;
  _ingredient RECORD;
  _min_capacity NUMERIC := 999999999;
  _capacity NUMERIC;
  _stock_map jsonb := '{}'::jsonb;
BEGIN
  -- Get active recipe
  SELECT id, yield_quantity INTO _recipe
  FROM public.recipes
  WHERE product_id = _elaborado_id AND is_active = true
  LIMIT 1;

  IF _recipe IS NULL THEN
    -- No recipe, set stock to 0
    INSERT INTO public.branch_stock (branch_id, product_id, quantity)
    VALUES (_branch_id, _elaborado_id, 0)
    ON CONFLICT (branch_id, product_id)
    DO UPDATE SET quantity = 0, updated_at = now();
    RETURN;
  END IF;

  -- Get all base ingredients stock
  FOR _ingredient IN
    SELECT ri.ingredient_id, ri.quantity, ri.unit,
           p.unit_of_measure,
           COALESCE(bs.quantity, 0) as available
    FROM public.recipe_ingredients ri
    JOIN public.products p ON p.id = ri.ingredient_id
    LEFT JOIN public.branch_stock bs ON bs.product_id = ri.ingredient_id AND bs.branch_id = _branch_id
    WHERE ri.recipe_id = _recipe.id AND ri.ingredient_type = 'base'
  LOOP
    -- Calculate how many batches we can make with this ingredient
    IF _ingredient.quantity > 0 THEN
      _capacity := FLOOR((_ingredient.available / _ingredient.quantity) * COALESCE(_recipe.yield_quantity, 1));
      IF _capacity < _min_capacity THEN
        _min_capacity := _capacity;
      END IF;
    END IF;
  END LOOP;

  -- Update elaborado stock
  IF _min_capacity = 999999999 THEN
    _min_capacity := 0;
  END IF;

  INSERT INTO public.branch_stock (branch_id, product_id, quantity)
  VALUES (_branch_id, _elaborado_id, _min_capacity)
  ON CONFLICT (branch_id, product_id)
  DO UPDATE SET quantity = _min_capacity, updated_at = now();
END;
$$;

-- Trigger function to update elaborado stock when ingredients change
CREATE OR REPLACE FUNCTION public.update_elaborado_after_ingredient_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _elaborado_id uuid;
BEGIN
  -- Find all elaborado products that use this ingredient in their recipes
  FOR _elaborado_id IN
    SELECT DISTINCT p.id
    FROM public.products p
    JOIN public.recipes r ON r.product_id = p.id AND r.is_active = true
    JOIN public.recipe_ingredients ri ON ri.recipe_id = r.id
    WHERE ri.ingredient_id = COALESCE(NEW.product_id, OLD.product_id)
      AND ri.ingredient_type = 'base'
      AND p.tipo = 'elaborado'
  LOOP
    PERFORM public.recalculate_elaborado_stock(_elaborado_id, COALESCE(NEW.branch_id, OLD.branch_id));
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger on branch_stock for ingredient updates
DROP TRIGGER IF EXISTS trigger_update_elaborado_stock ON public.branch_stock;
CREATE TRIGGER trigger_update_elaborado_stock
AFTER INSERT OR UPDATE OR DELETE ON public.branch_stock
FOR EACH ROW
EXECUTE FUNCTION public.update_elaborado_after_ingredient_change();

-- Update existing deduct_recipe_ingredients_on_sale to also update elaborado stock
CREATE OR REPLACE FUNCTION public.deduct_recipe_ingredients_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _product RECORD;
  _recipe RECORD;
  _ingredient RECORD;
  _sale_branch_id UUID;
  _deduct_qty NUMERIC;
  _selected_agregos text[];
BEGIN
  -- Get the product tipo
  SELECT tipo INTO _product FROM public.products WHERE id = NEW.product_id;
  
  IF _product IS NULL OR _product.tipo != 'elaborado' THEN
    RETURN NEW;
  END IF;

  -- Get sale branch_id
  SELECT branch_id INTO _sale_branch_id FROM public.sales WHERE id = NEW.sale_id;
  IF _sale_branch_id IS NULL THEN RETURN NEW; END IF;

  -- Get active recipe
  SELECT id, yield_quantity INTO _recipe
  FROM public.recipes
  WHERE product_id = NEW.product_id AND is_active = true
  LIMIT 1;

  IF _recipe IS NULL THEN RETURN NEW; END IF;

  -- Extract selected agregos from sale_item notes (JSON array of ingredient IDs)
  BEGIN
    IF NEW.notes IS NOT NULL AND NEW.notes LIKE '[%' THEN
      SELECT array_agg(val::text) INTO _selected_agregos
      FROM json_array_elements_text(NEW.notes::json) AS val;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    _selected_agregos := NULL;
  END;

  -- Deduct each ingredient
  FOR _ingredient IN
    SELECT ingredient_id, quantity, ingredient_type, gramaje 
    FROM public.recipe_ingredients 
    WHERE recipe_id = _recipe.id
  LOOP
    -- Base ingredients always deduct proportionally
    IF _ingredient.ingredient_type = 'base' THEN
      _deduct_qty := (_ingredient.quantity / _recipe.yield_quantity) * NEW.quantity;
    -- Agrego ingredients only deduct if selected, using gramaje
    ELSIF _ingredient.ingredient_type = 'agrego' THEN
      IF _selected_agregos IS NOT NULL AND _ingredient.ingredient_id::text = ANY(_selected_agregos) THEN
        _deduct_qty := _ingredient.gramaje * NEW.quantity;
      ELSE
        CONTINUE;
      END IF;
    ELSE
      CONTINUE;
    END IF;

    IF _deduct_qty <= 0 THEN CONTINUE; END IF;

    UPDATE public.branch_stock
    SET quantity = quantity - _deduct_qty, updated_at = now()
    WHERE branch_id = _sale_branch_id AND product_id = _ingredient.ingredient_id;

    -- Log movement
    INSERT INTO public.inventory_movements (branch_id, product_id, user_id, movement_type, quantity, reference_id, notes)
    SELECT _sale_branch_id, _ingredient.ingredient_id, s.user_id, 'sale', _deduct_qty, NEW.sale_id,
           CASE _ingredient.ingredient_type WHEN 'agrego' THEN 'Auto: agrego de receta' ELSE 'Auto: ingrediente base de receta' END
    FROM public.sales s WHERE s.id = NEW.sale_id;
  END LOOP;

  -- Recalculate elaborado stock after deducting ingredients
  PERFORM public.recalculate_elaborado_stock(NEW.product_id, _sale_branch_id);

  RETURN NEW;
END;
$$;