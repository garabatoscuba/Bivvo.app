
-- Update update_stock_on_sale to skip granel products (their stock comes from recipe ingredients)
CREATE OR REPLACE FUNCTION public.update_stock_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    sale_branch_id UUID;
    _product_tipo TEXT;
BEGIN
    SELECT branch_id INTO sale_branch_id FROM public.sales WHERE id = NEW.sale_id;
    SELECT tipo INTO _product_tipo FROM public.products WHERE id = NEW.product_id;

    -- Elaborado: skip entirely, stock deducted when kitchen moves to 'preparando'
    IF _product_tipo = 'elaborado' THEN
        RETURN NEW;
    END IF;

    -- Granel: skip direct branch_stock deduction, ingredients deducted by deduct_recipe_ingredients_on_sale
    IF _product_tipo = 'granel' THEN
        -- Log inventory movement
        INSERT INTO public.inventory_movements (branch_id, product_id, user_id, movement_type, quantity, reference_id)
        SELECT sale_branch_id, NEW.product_id, s.user_id, 'sale', NEW.quantity, NEW.sale_id
        FROM public.sales s WHERE s.id = NEW.sale_id;
        RETURN NEW;
    END IF;

    -- Regular/ingredient products: deduct stock directly
    UPDATE public.branch_stock
    SET quantity = quantity - NEW.quantity, updated_at = now()
    WHERE branch_id = sale_branch_id AND product_id = NEW.product_id;

    IF NOT FOUND THEN
        INSERT INTO public.branch_stock (branch_id, product_id, quantity)
        VALUES (sale_branch_id, NEW.product_id, -NEW.quantity);
    END IF;

    -- Log inventory movement
    INSERT INTO public.inventory_movements (branch_id, product_id, user_id, movement_type, quantity, reference_id)
    SELECT sale_branch_id, NEW.product_id, s.user_id, 'sale', NEW.quantity, NEW.sale_id
    FROM public.sales s WHERE s.id = NEW.sale_id;

    RETURN NEW;
END;
$$;

-- Update deduct_recipe_ingredients_on_sale to deduct raw material ingredients for granel products
CREATE OR REPLACE FUNCTION public.deduct_recipe_ingredients_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _product_tipo TEXT;
    _sale_branch_id UUID;
    _recipe RECORD;
    _ingredient RECORD;
    _deduct_qty NUMERIC;
    _stock_unit TEXT;
BEGIN
    SELECT tipo INTO _product_tipo FROM public.products WHERE id = NEW.product_id;
    
    -- Only process granel products here (elaborado deducted via kitchen workflow)
    IF _product_tipo != 'granel' THEN
        RETURN NEW;
    END IF;

    SELECT branch_id INTO _sale_branch_id FROM public.sales WHERE id = NEW.sale_id;

    -- Find active recipe for this product
    SELECT id, yield_quantity INTO _recipe
    FROM public.recipes
    WHERE product_id = NEW.product_id AND is_active = true
    LIMIT 1;

    IF _recipe.id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Deduct each base ingredient
    FOR _ingredient IN
        SELECT ri.ingredient_id, ri.quantity, ri.unit, ri.is_raw_material
        FROM public.recipe_ingredients ri
        WHERE ri.recipe_id = _recipe.id AND ri.ingredient_type = 'base'
    LOOP
        _deduct_qty := (_ingredient.quantity / COALESCE(_recipe.yield_quantity, 1)) * NEW.quantity;

        IF _ingredient.is_raw_material THEN
            -- Deduct from raw_materials.stock_vendedor
            UPDATE public.raw_materials
            SET stock_vendedor = GREATEST(0, stock_vendedor - _deduct_qty),
                updated_at = now()
            WHERE id = _ingredient.ingredient_id;
        ELSE
            -- Deduct from branch_stock for product-type ingredients
            UPDATE public.branch_stock
            SET quantity = GREATEST(0, quantity - _deduct_qty),
                updated_at = now()
            WHERE branch_id = _sale_branch_id AND product_id = _ingredient.ingredient_id;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$;
