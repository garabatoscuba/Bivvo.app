-- Trigger: Update ingredient cost_price with weighted average on new stock entry
CREATE OR REPLACE FUNCTION public.update_ingredient_weighted_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _product RECORD;
  _total_stock NUMERIC;
  _new_cost NUMERIC;
BEGIN
  IF NEW.unit_cost IS NULL OR NEW.unit_cost <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT tipo, cost_price INTO _product
  FROM public.products
  WHERE id = NEW.product_id;

  IF _product IS NULL OR _product.tipo != 'ingrediente' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(quantity + warehouse_quantity), 0) INTO _total_stock
  FROM public.branch_stock
  WHERE product_id = NEW.product_id;

  _total_stock := _total_stock - NEW.quantity;
  IF _total_stock < 0 THEN _total_stock := 0; END IF;

  IF _total_stock + NEW.quantity > 0 THEN
    _new_cost := ((_total_stock * COALESCE(_product.cost_price, 0)) + (NEW.quantity * NEW.unit_cost)) / (_total_stock + NEW.quantity);
  ELSE
    _new_cost := NEW.unit_cost;
  END IF;

  UPDATE public.products
  SET cost_price = ROUND(_new_cost, 4), updated_at = now()
  WHERE id = NEW.product_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_ingredient_weighted_cost ON public.product_stock_entries;
CREATE TRIGGER trg_update_ingredient_weighted_cost
  AFTER INSERT ON public.product_stock_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ingredient_weighted_cost();