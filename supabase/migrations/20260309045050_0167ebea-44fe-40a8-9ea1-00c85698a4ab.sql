
CREATE OR REPLACE FUNCTION public.update_elaborado_after_recipe_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _product_id uuid;
  _branch_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _product_id := OLD.product_id;
  ELSE
    _product_id := NEW.product_id;
  END IF;

  FOR _branch_id IN
    SELECT b.id FROM public.branches b
    JOIN public.products p ON p.business_id = b.business_id
    WHERE p.id = _product_id
  LOOP
    PERFORM public.recalculate_elaborado_stock(_product_id, _branch_id);
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
