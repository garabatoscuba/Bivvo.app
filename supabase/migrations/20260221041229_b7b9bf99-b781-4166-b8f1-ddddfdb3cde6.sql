
-- Add cancellation_reason column to sales
ALTER TABLE public.sales ADD COLUMN cancellation_reason text;

-- Update restore_stock_on_cancel to also create notification
CREATE OR REPLACE FUNCTION public.restore_stock_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  biz_id UUID;
  branch_name TEXT;
  sale_total NUMERIC;
  seller_name TEXT;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Restore stock
    UPDATE public.branch_stock bs
    SET quantity = bs.quantity + si.quantity, updated_at = now()
    FROM public.sale_items si
    WHERE si.sale_id = NEW.id
      AND bs.branch_id = NEW.branch_id
      AND bs.product_id = si.product_id;

    -- Log return movements
    INSERT INTO public.inventory_movements (branch_id, product_id, user_id, movement_type, quantity, reference_id, notes)
    SELECT NEW.branch_id, si.product_id, NEW.user_id, 'return', si.quantity, NEW.id,
           'Devolución por cancelación de venta ' || NEW.sale_number
    FROM public.sale_items si
    WHERE si.sale_id = NEW.id;

    -- Create notification for owner/manager
    SELECT b.business_id, b.name INTO biz_id, branch_name
    FROM public.branches b WHERE b.id = NEW.branch_id;

    SELECT p.full_name INTO seller_name
    FROM public.profiles p WHERE p.user_id = NEW.user_id LIMIT 1;

    INSERT INTO public.notifications (business_id, branch_id, type, title, message, metadata)
    VALUES (
      biz_id,
      NEW.branch_id,
      'sale_cancelled',
      'Venta cancelada: ' || NEW.sale_number,
      COALESCE(seller_name, 'Usuario') || ' canceló la venta ' || NEW.sale_number || ' ($' || NEW.total || ') en ' || COALESCE(branch_name, 'sucursal') || '. Motivo: ' || COALESCE(NEW.cancellation_reason, 'Sin especificar'),
      jsonb_build_object('sale_id', NEW.id, 'sale_number', NEW.sale_number, 'total', NEW.total, 'reason', NEW.cancellation_reason, 'cancelled_by', NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$function$;
