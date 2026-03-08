
-- Add tipo column to products
ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'reventa';

-- Create recipes table
CREATE TABLE public.recipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  yield_quantity numeric NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create recipe_ingredients table
CREATE TABLE public.recipe_ingredients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'Pieza',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS on recipes
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage recipes of their business" ON public.recipes
  FOR ALL TO authenticated
  USING (business_id = public.get_user_business_id(auth.uid()))
  WITH CHECK (business_id = public.get_user_business_id(auth.uid()));

-- RLS on recipe_ingredients
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage recipe ingredients via recipe" ON public.recipe_ingredients
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.business_id = public.get_user_business_id(auth.uid())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.recipes r WHERE r.id = recipe_id AND r.business_id = public.get_user_business_id(auth.uid())
  ));

-- Updated_at triggers
CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: auto-deduct ingredient stock when selling elaborado products
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

  -- Deduct each ingredient proportionally
  FOR _ingredient IN
    SELECT ingredient_id, quantity FROM public.recipe_ingredients WHERE recipe_id = _recipe.id
  LOOP
    _deduct_qty := (_ingredient.quantity / _recipe.yield_quantity) * NEW.quantity;

    UPDATE public.branch_stock
    SET quantity = quantity - _deduct_qty, updated_at = now()
    WHERE branch_id = _sale_branch_id AND product_id = _ingredient.ingredient_id;

    -- Log movement
    INSERT INTO public.inventory_movements (branch_id, product_id, user_id, movement_type, quantity, reference_id, notes)
    SELECT _sale_branch_id, _ingredient.ingredient_id, s.user_id, 'sale', _deduct_qty, NEW.sale_id,
           'Auto: ingrediente de receta'
    FROM public.sales s WHERE s.id = NEW.sale_id;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deduct_recipe_ingredients ON public.sale_items;
CREATE TRIGGER trg_deduct_recipe_ingredients
  AFTER INSERT ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_recipe_ingredients_on_sale();
