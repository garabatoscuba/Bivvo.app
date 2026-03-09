
-- Fix deduct_recipe_ingredients_on_sale to use unit conversion
CREATE OR REPLACE FUNCTION public.deduct_recipe_ingredients_on_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _product RECORD;
  _recipe RECORD;
  _ingredient RECORD;
  _sale_branch_id UUID;
  _deduct_qty NUMERIC;
  _selected_agregos text[];
  _stock_unit TEXT;
BEGIN
  SELECT tipo INTO _product FROM public.products WHERE id = NEW.product_id;
  
  IF _product IS NULL OR _product.tipo != 'elaborado' THEN
    RETURN NEW;
  END IF;

  SELECT branch_id INTO _sale_branch_id FROM public.sales WHERE id = NEW.sale_id;
  IF _sale_branch_id IS NULL THEN RETURN NEW; END IF;

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
    SELECT ri.ingredient_id, ri.quantity, ri.ingredient_type, ri.gramaje, ri.unit,
           p.unit_of_measure
    FROM public.recipe_ingredients ri
    JOIN public.products p ON p.id = ri.ingredient_id
    WHERE ri.recipe_id = _recipe.id
  LOOP
    -- Get the stock unit (product's unit_of_measure)
    _stock_unit := COALESCE(_ingredient.unit_of_measure, 'pieza');

    IF _ingredient.ingredient_type = 'base' THEN
      -- Recipe quantity is in recipe unit, convert to stock unit
      _deduct_qty := (_ingredient.quantity / COALESCE(_recipe.yield_quantity, 1)) * NEW.quantity;
      -- Convert from recipe unit to stock unit
      IF _ingredient.unit IS NOT NULL AND _ingredient.unit != '' THEN
        _deduct_qty := public.convert_recipe_units(_deduct_qty, _ingredient.unit, _stock_unit);
      END IF;

    ELSIF _ingredient.ingredient_type = 'agrego' THEN
      IF _selected_agregos IS NOT NULL AND _ingredient.ingredient_id::text = ANY(_selected_agregos) THEN
        -- Count how many times this agrego appears in selections
        _deduct_qty := 0;
        FOR i IN 1..array_length(_selected_agregos, 1) LOOP
          IF _selected_agregos[i] = _ingredient.ingredient_id::text THEN
            _deduct_qty := _deduct_qty + COALESCE(_ingredient.gramaje, 0);
          END IF;
        END LOOP;
        _deduct_qty := _deduct_qty * NEW.quantity;
        -- Convert gramaje (which is in recipe unit) to stock unit
        IF _ingredient.unit IS NOT NULL AND _ingredient.unit != '' THEN
          _deduct_qty := public.convert_recipe_units(_deduct_qty, _ingredient.unit, _stock_unit);
        END IF;
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

    INSERT INTO public.inventory_movements (branch_id, product_id, user_id, movement_type, quantity, reference_id, notes)
    SELECT _sale_branch_id, _ingredient.ingredient_id, s.user_id, 'sale', _deduct_qty, NEW.sale_id,
           CASE _ingredient.ingredient_type WHEN 'agrego' THEN 'Auto: agrego de receta' ELSE 'Auto: ingrediente base de receta' END
    FROM public.sales s WHERE s.id = NEW.sale_id;
  END LOOP;

  PERFORM public.recalculate_elaborado_stock(NEW.product_id, _sale_branch_id);

  RETURN NEW;
END;
$function$;

-- Fix recalculate_elaborado_stock to use unit conversion
CREATE OR REPLACE FUNCTION public.recalculate_elaborado_stock(_elaborado_id uuid, _branch_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _recipe RECORD;
  _ingredient RECORD;
  _min_capacity NUMERIC := 999999999;
  _capacity NUMERIC;
  _needed_in_stock_unit NUMERIC;
BEGIN
  SELECT id, yield_quantity INTO _recipe
  FROM public.recipes
  WHERE product_id = _elaborado_id AND is_active = true
  LIMIT 1;

  IF _recipe IS NULL THEN
    INSERT INTO public.branch_stock (branch_id, product_id, quantity)
    VALUES (_branch_id, _elaborado_id, 0)
    ON CONFLICT (branch_id, product_id)
    DO UPDATE SET quantity = 0, updated_at = now();
    RETURN;
  END IF;

  FOR _ingredient IN
    SELECT ri.ingredient_id, ri.quantity, ri.unit,
           p.unit_of_measure,
           COALESCE(bs.quantity, 0) as available
    FROM public.recipe_ingredients ri
    JOIN public.products p ON p.id = ri.ingredient_id
    LEFT JOIN public.branch_stock bs ON bs.product_id = ri.ingredient_id AND bs.branch_id = _branch_id
    WHERE ri.recipe_id = _recipe.id AND ri.ingredient_type = 'base'
  LOOP
    IF _ingredient.quantity > 0 THEN
      -- Convert recipe quantity to stock unit
      _needed_in_stock_unit := _ingredient.quantity;
      IF _ingredient.unit IS NOT NULL AND _ingredient.unit != '' AND _ingredient.unit_of_measure IS NOT NULL THEN
        _needed_in_stock_unit := public.convert_recipe_units(_ingredient.quantity, _ingredient.unit, _ingredient.unit_of_measure);
      END IF;

      _capacity := FLOOR((_ingredient.available / _needed_in_stock_unit) * COALESCE(_recipe.yield_quantity, 1));
      IF _capacity < _min_capacity THEN
        _min_capacity := _capacity;
      END IF;
    END IF;
  END LOOP;

  IF _min_capacity = 999999999 THEN
    _min_capacity := 0;
  END IF;

  INSERT INTO public.branch_stock (branch_id, product_id, quantity)
  VALUES (_branch_id, _elaborado_id, _min_capacity)
  ON CONFLICT (branch_id, product_id)
  DO UPDATE SET quantity = _min_capacity, updated_at = now();
END;
$function$;
