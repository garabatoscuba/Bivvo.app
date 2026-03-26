
-- Create service_cost_ingredients table (independent from product recipes)
CREATE TABLE public.service_cost_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 1,
  unit text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_cost_ingredients ENABLE ROW LEVEL SECURITY;

-- RLS policies: business owners/managers can manage via their categories
CREATE POLICY "Users can view service cost ingredients for their business"
ON public.service_cost_ingredients FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.service_categories sc
    WHERE sc.id = service_cost_ingredients.category_id
      AND sc.business_id = public.get_user_business_id(auth.uid())
  )
);

CREATE POLICY "Users can insert service cost ingredients for their business"
ON public.service_cost_ingredients FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.service_categories sc
    WHERE sc.id = service_cost_ingredients.category_id
      AND sc.business_id = public.get_user_business_id(auth.uid())
  )
);

CREATE POLICY "Users can update service cost ingredients for their business"
ON public.service_cost_ingredients FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.service_categories sc
    WHERE sc.id = service_cost_ingredients.category_id
      AND sc.business_id = public.get_user_business_id(auth.uid())
  )
);

CREATE POLICY "Users can delete service cost ingredients for their business"
ON public.service_cost_ingredients FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.service_categories sc
    WHERE sc.id = service_cost_ingredients.category_id
      AND sc.business_id = public.get_user_business_id(auth.uid())
  )
);

-- Drop the old recipe_id column from service_categories (no longer needed)
ALTER TABLE public.service_categories DROP COLUMN IF EXISTS recipe_id;

-- Replace the trigger function to use service_cost_ingredients instead of recipes
CREATE OR REPLACE FUNCTION public.deduct_service_recipe_ingredients()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ingredient RECORD;
  _deduct_qty NUMERIC;
BEGIN
  -- Only process if category_id is set
  IF NEW.category_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if category has cost ingredients
  IF NOT EXISTS (
    SELECT 1 FROM public.service_cost_ingredients WHERE category_id = NEW.category_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Deduct each ingredient
  FOR _ingredient IN
    SELECT sci.material_id, sci.quantity, sci.unit,
           rm.unit_use, rm.costo_unitario
    FROM public.service_cost_ingredients sci
    JOIN public.raw_materials rm ON rm.id = sci.material_id
    WHERE sci.category_id = NEW.category_id
  LOOP
    _deduct_qty := _ingredient.quantity;

    IF _deduct_qty <= 0 THEN CONTINUE; END IF;

    -- Deduct from raw_materials stock_vendedor
    UPDATE public.raw_materials
    SET stock_vendedor = GREATEST(0, stock_vendedor - _deduct_qty),
        updated_at = now()
    WHERE id = _ingredient.material_id;

    -- Log inventory movement
    INSERT INTO public.inventory_movements (branch_id, product_id, user_id, movement_type, quantity, notes)
    VALUES (NEW.branch_id, _ingredient.material_id, NEW.user_id, 'sale', _deduct_qty, 'Auto: servicio con ficha de costo');
  END LOOP;

  RETURN NEW;
END;
$$;
