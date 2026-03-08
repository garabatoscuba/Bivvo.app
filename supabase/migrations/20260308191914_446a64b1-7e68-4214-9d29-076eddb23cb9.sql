
CREATE OR REPLACE FUNCTION public.notify_low_stock_material()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  total_stock NUMERIC;
  biz_id UUID;
BEGIN
  total_stock := COALESCE(NEW.stock_almacen, 0) + COALESCE(NEW.stock_vendedor, 0);

  IF NEW.stock_minimo > 0 AND total_stock <= NEW.stock_minimo AND total_stock >= 0 THEN
    biz_id := NEW.business_id;

    -- Avoid duplicate notifications for same material in last hour
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE business_id = biz_id
        AND type = 'low_stock_material'
        AND metadata->>'material_id' = NEW.id::text
        AND created_at > now() - interval '1 hour'
    ) THEN
      INSERT INTO public.notifications (business_id, branch_id, type, title, message, metadata)
      VALUES (
        biz_id,
        NEW.branch_id,
        'low_stock_material',
        'Insumo bajo: ' || NEW.name,
        NEW.name || ' tiene ' || total_stock || ' unidades en total. Mínimo: ' || NEW.stock_minimo,
        jsonb_build_object('material_id', NEW.id, 'branch_id', NEW.branch_id, 'total_stock', total_stock, 'stock_minimo', NEW.stock_minimo)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_low_stock_material
AFTER UPDATE ON public.raw_materials
FOR EACH ROW
EXECUTE FUNCTION public.notify_low_stock_material();
