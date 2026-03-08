
-- Add job_item_id to print_ink_usage to link automatic entries
ALTER TABLE public.print_ink_usage 
  ADD COLUMN IF NOT EXISTS job_item_id UUID REFERENCES public.print_job_items(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_automatic BOOLEAN NOT NULL DEFAULT false;

-- Make periodo_inicio and periodo_fin nullable for automatic entries
ALTER TABLE public.print_ink_usage 
  ALTER COLUMN periodo_inicio DROP NOT NULL,
  ALTER COLUMN periodo_fin DROP NOT NULL;

-- Trigger function: auto-calculate ink consumption on print_job_items insert
CREATE OR REPLACE FUNCTION public.auto_register_ink_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _job RECORD;
  _service RECORD;
  _consumo NUMERIC;
  _consumo_por_color NUMERIC;
BEGIN
  -- Get parent job info
  SELECT business_id, branch_id, user_id INTO _job
  FROM public.print_jobs WHERE id = NEW.job_id;

  IF _job IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get service type to read consumo_por_unidad
  IF NEW.service_type_id IS NOT NULL THEN
    SELECT consumo_por_unidad INTO _service
    FROM public.print_service_types WHERE id = NEW.service_type_id;
  END IF;

  -- If no service or no consumo configured, skip
  IF _service IS NULL OR COALESCE(_service.consumo_por_unidad, 0) = 0 THEN
    RETURN NEW;
  END IF;

  -- Formula: consumo = precio_cobrado * cantidad * (consumo_por_unidad / 100)
  _consumo := NEW.precio_cobrado * NEW.cantidad * (_service.consumo_por_unidad / 100.0);

  IF _consumo <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.es_color = false THEN
    -- All consumption goes to Negro
    INSERT INTO public.print_ink_usage (
      business_id, color, cantidad_consumida, hojas_impresas, costo_por_hoja,
      periodo_inicio, periodo_fin, user_id, nota, job_item_id, is_automatic
    ) VALUES (
      _job.business_id, 'negro', _consumo, NEW.cantidad, 
      CASE WHEN NEW.cantidad > 0 THEN _consumo / NEW.cantidad ELSE 0 END,
      CURRENT_DATE::text, CURRENT_DATE::text, _job.user_id,
      'Auto: B/N', NEW.id, true
    );
  ELSE
    -- Distribute equally among 4 colors
    _consumo_por_color := _consumo / 4.0;
    
    INSERT INTO public.print_ink_usage (
      business_id, color, cantidad_consumida, hojas_impresas, costo_por_hoja,
      periodo_inicio, periodo_fin, user_id, nota, job_item_id, is_automatic
    ) VALUES 
      (_job.business_id, 'negro', _consumo_por_color, NEW.cantidad, 
       CASE WHEN NEW.cantidad > 0 THEN _consumo_por_color / NEW.cantidad ELSE 0 END,
       CURRENT_DATE::text, CURRENT_DATE::text, _job.user_id, 'Auto: Color', NEW.id, true),
      (_job.business_id, 'cian', _consumo_por_color, NEW.cantidad,
       CASE WHEN NEW.cantidad > 0 THEN _consumo_por_color / NEW.cantidad ELSE 0 END,
       CURRENT_DATE::text, CURRENT_DATE::text, _job.user_id, 'Auto: Color', NEW.id, true),
      (_job.business_id, 'magenta', _consumo_por_color, NEW.cantidad,
       CASE WHEN NEW.cantidad > 0 THEN _consumo_por_color / NEW.cantidad ELSE 0 END,
       CURRENT_DATE::text, CURRENT_DATE::text, _job.user_id, 'Auto: Color', NEW.id, true),
      (_job.business_id, 'amarillo', _consumo_por_color, NEW.cantidad,
       CASE WHEN NEW.cantidad > 0 THEN _consumo_por_color / NEW.cantidad ELSE 0 END,
       CURRENT_DATE::text, CURRENT_DATE::text, _job.user_id, 'Auto: Color', NEW.id, true);
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_auto_ink_usage ON public.print_job_items;
CREATE TRIGGER trg_auto_ink_usage
  AFTER INSERT ON public.print_job_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_register_ink_usage();
