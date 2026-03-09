
CREATE OR REPLACE FUNCTION public.create_kitchen_order_on_elaborado_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _product_tipo TEXT;
  _product_name TEXT;
  _sale_branch_id UUID;
  _business_id UUID;
  _sale_number TEXT;
  _new_item JSONB;
BEGIN
  SELECT tipo, name INTO _product_tipo, _product_name
  FROM public.products WHERE id = NEW.product_id;

  IF _product_tipo IS NULL OR _product_tipo != 'elaborado' THEN
    RETURN NEW;
  END IF;

  SELECT branch_id, sale_number INTO _sale_branch_id, _sale_number
  FROM public.sales WHERE id = NEW.sale_id;
  IF _sale_branch_id IS NULL THEN RETURN NEW; END IF;

  SELECT business_id INTO _business_id FROM public.branches WHERE id = _sale_branch_id;

  _new_item := jsonb_build_object(
    'product_id', NEW.product_id,
    'product_name', _product_name,
    'quantity', NEW.quantity,
    'sale_item_id', NEW.id,
    'notes', COALESCE(NEW.notes, '')
  );

  INSERT INTO public.kitchen_orders (business_id, branch_id, sale_id, status, items, sale_number)
  VALUES (_business_id, _sale_branch_id, NEW.sale_id, 'recibido', jsonb_build_array(_new_item), COALESCE(_sale_number, ''))
  ON CONFLICT (sale_id) DO UPDATE
    SET items = kitchen_orders.items || jsonb_build_array(_new_item),
        updated_at = now();

  RETURN NEW;
END;
$function$;
