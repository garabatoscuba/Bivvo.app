
-- Add ingredient_type and gramaje to recipe_ingredients
ALTER TABLE public.recipe_ingredients 
  ADD COLUMN IF NOT EXISTS ingredient_type text NOT NULL DEFAULT 'base',
  ADD COLUMN IF NOT EXISTS gramaje numeric NOT NULL DEFAULT 0;

-- Update the deduct trigger to handle base vs agrego
-- Base ingredients always deduct; agrego ingredients deduct only when selected (via sale_item metadata)
CREATE OR REPLACE FUNCTION public.deduct_recipe_ingredients_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  RETURN NEW;
END;
$$;
