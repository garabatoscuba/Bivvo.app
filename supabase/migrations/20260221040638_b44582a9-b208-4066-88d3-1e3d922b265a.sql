
CREATE OR REPLACE FUNCTION public.restore_stock_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only act when status changes to 'cancelled'
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Restore stock for each sale item
    UPDATE public.branch_stock bs
    SET quantity = bs.quantity + si.quantity,
        updated_at = now()
    FROM public.sale_items si
    WHERE si.sale_id = NEW.id
      AND bs.branch_id = NEW.branch_id
      AND bs.product_id = si.product_id;

    -- Log return movements
    INSERT INTO public.inventory_movements (branch_id, product_id, user_id, movement_type, quantity, reference_id, notes)
    SELECT NEW.branch_id, si.product_id, NEW.user_id, 'return', si.quantity, NEW.id, 'Devolución por cancelación de venta ' || NEW.sale_number
    FROM public.sale_items si
    WHERE si.sale_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_restore_stock_on_cancel
BEFORE UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.restore_stock_on_cancel();
