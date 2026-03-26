
-- Add recipe-like columns to service_categories
ALTER TABLE public.service_categories
  ADD COLUMN IF NOT EXISTS yield_quantity integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cost_method text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS indirect_cost_percentage numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS indirect_cost_amount numeric NOT NULL DEFAULT 0;

-- Add recipe-like columns to service_cost_ingredients
ALTER TABLE public.service_cost_ingredients
  ADD COLUMN IF NOT EXISTS ingredient_type text NOT NULL DEFAULT 'base',
  ADD COLUMN IF NOT EXISTS gramaje numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_raw_material boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS surcharge numeric NOT NULL DEFAULT 0;

-- Update the deduction trigger to handle unit conversion, yield, and only base ingredients
CREATE OR REPLACE FUNCTION public.deduct_service_recipe_ingredients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ingredient RECORD;
  _deduct_qty NUMERIC;
  _yield_qty NUMERIC;
BEGIN
  IF NEW.category_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get yield from service_categories
  SELECT COALESCE(yield_quantity, 1) INTO _yield_qty
  FROM public.service_categories WHERE id = NEW.category_id;
  IF _yield_qty IS NULL OR _yield_qty < 1 THEN _yield_qty := 1; END IF;

  -- Only deduct base ingredients
  IF NOT EXISTS (
    SELECT 1 FROM public.service_cost_ingredients
    WHERE category_id = NEW.category_id AND ingredient_type = 'base'
  ) THEN
    RETURN NEW;
  END IF;

  FOR _ingredient IN
    SELECT sci.material_id, sci.quantity, sci.unit,
           rm.unit_purchase, rm.costo_unitario
    FROM public.service_cost_ingredients sci
    JOIN public.raw_materials rm ON rm.id = sci.material_id
    WHERE sci.category_id = NEW.category_id
      AND sci.ingredient_type = 'base'
  LOOP
    -- Convert quantity from recipe unit to purchase unit, then divide by yield
    _deduct_qty := public.convert_recipe_units(
      _ingredient.quantity,
      COALESCE(_ingredient.unit, _ingredient.unit_purchase, 'pieza'),
      COALESCE(_ingredient.unit_purchase, 'pieza')
    ) / _yield_qty;

    IF _deduct_qty <= 0 THEN CONTINUE; END IF;

    UPDATE public.raw_materials
    SET stock_vendedor = GREATEST(0, stock_vendedor - _deduct_qty),
        updated_at = now()
    WHERE id = _ingredient.material_id;

    INSERT INTO public.inventory_movements (branch_id, product_id, user_id, movement_type, quantity, notes)
    VALUES (NEW.branch_id, _ingredient.material_id, NEW.user_id, 'sale', _deduct_qty, 'Auto: servicio con ficha de costo');
  END LOOP;

  RETURN NEW;
END;
$$;
