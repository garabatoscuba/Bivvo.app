
-- =============================================
-- 1. New function: deduct ingredients when kitchen order moves to 'preparando'
-- =============================================
CREATE OR REPLACE FUNCTION public.deduct_ingredients_on_preparando()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _item RECORD;
  _recipe RECORD;
  _ingredient RECORD;
  _deduct_qty NUMERIC;
  _selected_agregos text[];
  _stock_unit TEXT;
BEGIN
  -- Only fire when status changes TO preparando
  IF NEW.status != 'preparando' OR OLD.status = 'preparando' THEN
    RETURN NEW;
  END IF;

  -- Loop through each item in the kitchen order
  FOR _item IN
    SELECT 
      (elem->>'product_id')::uuid AS product_id,
      (elem->>'quantity')::numeric AS quantity,
      (elem->>'sale_item_id')::uuid AS sale_item_id,
      COALESCE(elem->>'notes', '') AS notes
    FROM jsonb_array_elements(NEW.items) AS elem
  LOOP
    -- Get active recipe
    SELECT id, yield_quantity INTO _recipe
    FROM public.recipes
    WHERE product_id = _item.product_id AND is_active = true
    LIMIT 1;

    IF _recipe IS NULL THEN CONTINUE; END IF;

    -- Extract selected agregos from notes (JSON array of ingredient IDs)
    _selected_agregos := NULL;
    BEGIN
      IF _item.notes IS NOT NULL AND _item.notes LIKE '[%' THEN
        SELECT array_agg(val::text) INTO _selected_agregos
        FROM json_array_elements_text(_item.notes::json) AS val;
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
      _stock_unit := COALESCE(_ingredient.unit_of_measure, 'pieza');

      IF _ingredient.ingredient_type = 'base' THEN
        _deduct_qty := (_ingredient.quantity / COALESCE(_recipe.yield_quantity, 1)) * _item.quantity;
        IF _ingredient.unit IS NOT NULL AND _ingredient.unit != '' THEN
          _deduct_qty := public.convert_recipe_units(_deduct_qty, _ingredient.unit, _stock_unit);
        END IF;

      ELSIF _ingredient.ingredient_type = 'agrego' THEN
        IF _selected_agregos IS NOT NULL AND _ingredient.ingredient_id::text = ANY(_selected_agregos) THEN
          _deduct_qty := 0;
          FOR i IN 1..array_length(_selected_agregos, 1) LOOP
            IF _selected_agregos[i] = _ingredient.ingredient_id::text THEN
              _deduct_qty := _deduct_qty + COALESCE(_ingredient.gramaje, 0);
            END IF;
          END LOOP;
          _deduct_qty := _deduct_qty * _item.quantity;
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
      WHERE branch_id = NEW.branch_id AND product_id = _ingredient.ingredient_id;

      INSERT INTO public.inventory_movements (branch_id, product_id, user_id, movement_type, quantity, reference_id, notes)
      SELECT NEW.branch_id, _ingredient.ingredient_id, s.user_id, 'sale', _deduct_qty, NEW.sale_id,
             CASE _ingredient.ingredient_type WHEN 'agrego' THEN 'Auto: agrego en preparación' ELSE 'Auto: ingrediente en preparación' END
      FROM public.sales s WHERE s.id = NEW.sale_id;
    END LOOP;

    -- Recalculate elaborado stock
    PERFORM public.recalculate_elaborado_stock(_item.product_id, NEW.branch_id);
  END LOOP;

  RETURN NEW;
END;
$function$;

-- =============================================
-- 2. Update update_stock_on_sale: elaborado products do nothing (handled by kitchen preparando)
-- =============================================
CREATE OR REPLACE FUNCTION public.update_stock_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- =============================================
-- 3. Update deduct_recipe_ingredients_on_sale: do nothing for elaborado (handled by preparando)
-- =============================================
CREATE OR REPLACE FUNCTION public.deduct_recipe_ingredients_on_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _product RECORD;
BEGIN
  SELECT tipo INTO _product FROM public.products WHERE id = NEW.product_id;
  -- Elaborado products: ingredients deducted on kitchen 'preparando' status, not here
  -- Non-elaborado: no recipe to deduct
  RETURN NEW;
END;
$function$;

-- =============================================
-- 4. Drop any existing triggers to avoid duplicates, then create fresh
-- =============================================
DROP TRIGGER IF EXISTS trg_a_update_stock_on_sale ON public.sale_items;
DROP TRIGGER IF EXISTS trg_b_deduct_recipe_ingredients_on_sale ON public.sale_items;
DROP TRIGGER IF EXISTS trg_c_create_kitchen_order_on_elaborado_sale ON public.sale_items;
DROP TRIGGER IF EXISTS trg_restore_stock_on_cancel ON public.sales;
DROP TRIGGER IF EXISTS trg_update_elaborado_after_ingredient_change ON public.branch_stock;
DROP TRIGGER IF EXISTS trg_update_elaborado_after_ingredient_list_change ON public.recipe_ingredients;
DROP TRIGGER IF EXISTS trg_update_elaborado_after_recipe_change ON public.recipes;
DROP TRIGGER IF EXISTS trg_update_ingredient_weighted_cost ON public.product_stock_entries;
DROP TRIGGER IF EXISTS trg_notify_low_stock ON public.branch_stock;
DROP TRIGGER IF EXISTS trg_deduct_ingredients_on_preparando ON public.kitchen_orders;

-- sale_items triggers
CREATE TRIGGER trg_a_update_stock_on_sale
  AFTER INSERT ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_on_sale();

CREATE TRIGGER trg_c_create_kitchen_order_on_elaborado_sale
  AFTER INSERT ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.create_kitchen_order_on_elaborado_sale();

-- kitchen_orders: deduct ingredients when status → preparando
CREATE TRIGGER trg_deduct_ingredients_on_preparando
  AFTER UPDATE ON public.kitchen_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_ingredients_on_preparando();

-- sales: restore stock on cancel
CREATE TRIGGER trg_restore_stock_on_cancel
  AFTER UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.restore_stock_on_cancel();

-- branch_stock: recalculate elaborado when ingredient stock changes
CREATE TRIGGER trg_update_elaborado_after_ingredient_change
  AFTER UPDATE OF quantity ON public.branch_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_elaborado_after_ingredient_change();

-- recipe_ingredients: recalculate elaborado when recipe list changes
CREATE TRIGGER trg_update_elaborado_after_ingredient_list_change
  AFTER INSERT OR UPDATE OR DELETE ON public.recipe_ingredients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_elaborado_after_ingredient_list_change();

-- recipes: recalculate elaborado when recipe changes
CREATE TRIGGER trg_update_elaborado_after_recipe_change
  AFTER INSERT OR UPDATE OR DELETE ON public.recipes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_elaborado_after_recipe_change();

-- product_stock_entries: weighted cost
CREATE TRIGGER trg_update_ingredient_weighted_cost
  AFTER INSERT ON public.product_stock_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ingredient_weighted_cost();

-- branch_stock: low stock notification
CREATE TRIGGER trg_notify_low_stock
  AFTER UPDATE OF quantity ON public.branch_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_low_stock();
