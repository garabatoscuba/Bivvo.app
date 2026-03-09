CREATE OR REPLACE FUNCTION public.auto_register_ink_usage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _job RECORD;
  _service RECORD;
  _consumo NUMERIC;
  _consumo_por_color NUMERIC;
BEGIN
  SELECT business_id, branch_id, user_id INTO _job
  FROM public.print_jobs WHERE id = NEW.job_id;

  IF _job IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.service_type_id IS NOT NULL THEN
    SELECT consumo_por_unidad INTO _service
    FROM public.print_service_types WHERE id = NEW.service_type_id;
  END IF;

  IF _service IS NULL OR COALESCE(_service.consumo_por_unidad, 0) = 0 THEN
    RETURN NEW;
  END IF;

  _consumo := NEW.precio_cobrado * NEW.cantidad * (_service.consumo_por_unidad / 100.0);

  IF _consumo <= 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.es_color = false THEN
    INSERT INTO public.print_ink_usage (
      business_id, color, cantidad_consumida, hojas_impresas, costo_por_hoja,
      periodo_inicio, periodo_fin, user_id, nota, job_item_id, is_automatic
    ) VALUES (
      _job.business_id, 'negro', _consumo, NEW.cantidad, 
      CASE WHEN NEW.cantidad > 0 THEN _consumo / NEW.cantidad ELSE 0 END,
      CURRENT_DATE, CURRENT_DATE, _job.user_id,
      'Auto: B/N', NEW.id, true
    );
  ELSE
    _consumo_por_color := _consumo / 4.0;
    
    INSERT INTO public.print_ink_usage (
      business_id, color, cantidad_consumida, hojas_impresas, costo_por_hoja,
      periodo_inicio, periodo_fin, user_id, nota, job_item_id, is_automatic
    ) VALUES 
      (_job.business_id, 'negro', _consumo_por_color, NEW.cantidad, 
       CASE WHEN NEW.cantidad > 0 THEN _consumo_por_color / NEW.cantidad ELSE 0 END,
       CURRENT_DATE, CURRENT_DATE, _job.user_id, 'Auto: Color', NEW.id, true),
      (_job.business_id, 'cian', _consumo_por_color, NEW.cantidad,
       CASE WHEN NEW.cantidad > 0 THEN _consumo_por_color / NEW.cantidad ELSE 0 END,
       CURRENT_DATE, CURRENT_DATE, _job.user_id, 'Auto: Color', NEW.id, true),
      (_job.business_id, 'magenta', _consumo_por_color, NEW.cantidad,
       CASE WHEN NEW.cantidad > 0 THEN _consumo_por_color / NEW.cantidad ELSE 0 END,
       CURRENT_DATE, CURRENT_DATE, _job.user_id, 'Auto: Color', NEW.id, true),
      (_job.business_id, 'amarillo', _consumo_por_color, NEW.cantidad,
       CASE WHEN NEW.cantidad > 0 THEN _consumo_por_color / NEW.cantidad ELSE 0 END,
       CURRENT_DATE, CURRENT_DATE, _job.user_id, 'Auto: Color', NEW.id, true);
  END IF;

  RETURN NEW;
END;
$function$;