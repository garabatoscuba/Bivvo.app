
CREATE OR REPLACE FUNCTION public.update_elaborado_after_ingredient_list_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _product_id uuid;
  _branch_id uuid;
BEGIN
  SELECT product_id INTO _product_id FROM public.recipes WHERE id = COALESCE(NEW.recipe_id, OLD.recipe_id);
  
  IF _product_id IS NOT NULL THEN
    FOR _branch_id IN
      SELECT b.id FROM public.branches b
      JOIN public.products p ON p.business_id = b.business_id
      WHERE p.id = _product_id
    LOOP
      PERFORM public.recalculate_elaborado_stock(_product_id, _branch_id);
    END LOOP;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
