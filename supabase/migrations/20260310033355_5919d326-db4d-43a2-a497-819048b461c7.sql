
-- Create print_printers table
CREATE TABLE public.print_printers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  colores TEXT[] NOT NULL DEFAULT ARRAY['negro'],
  soporta_full BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.print_printers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage printers for their business" ON public.print_printers
  FOR ALL TO authenticated
  USING (business_id IN (
    SELECT business_id FROM public.profiles WHERE user_id = auth.uid()
    UNION
    SELECT business_id FROM public.employees WHERE auth_user_id = auth.uid()
  ))
  WITH CHECK (business_id IN (
    SELECT business_id FROM public.profiles WHERE user_id = auth.uid()
    UNION
    SELECT business_id FROM public.employees WHERE auth_user_id = auth.uid()
  ));

-- Add columns to print_job_items (es_full already exists)
ALTER TABLE public.print_job_items
  ADD COLUMN IF NOT EXISTS printer_id UUID REFERENCES public.print_printers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS colores_seleccionados TEXT[] DEFAULT NULL;

-- Add full_multiplier to copy_shop_config
ALTER TABLE public.copy_shop_config
  ADD COLUMN IF NOT EXISTS full_multiplier NUMERIC NOT NULL DEFAULT 2.0;

-- Update trigger function
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
  _colores TEXT[];
  _num_colores INT;
  _full_mult NUMERIC;
  _printer RECORD;
BEGIN
  SELECT business_id, branch_id, user_id INTO _job
  FROM public.print_jobs WHERE id = NEW.job_id;
  IF _job IS NULL THEN RETURN NEW; END IF;

  IF NEW.service_type_id IS NOT NULL THEN
    SELECT consumo_por_unidad INTO _service
    FROM public.print_service_types WHERE id = NEW.service_type_id;
  END IF;

  IF _service IS NULL OR COALESCE(_service.consumo_por_unidad, 0) = 0 THEN
    RETURN NEW;
  END IF;

  _consumo := NEW.precio_cobrado * NEW.cantidad * (_service.consumo_por_unidad / 100.0);
  IF _consumo <= 0 THEN RETURN NEW; END IF;

  SELECT COALESCE(full_multiplier, 2.0) INTO _full_mult
  FROM public.copy_shop_config WHERE business_id = _job.business_id;
  IF _full_mult IS NULL THEN _full_mult := 2.0; END IF;

  IF NEW.es_full = true THEN
    _consumo := _consumo * _full_mult;
  END IF;

  IF NEW.es_color = false THEN
    INSERT INTO public.print_ink_usage (
      business_id, color, cantidad_consumida, hojas_impresas, costo_por_hoja,
      periodo_inicio, periodo_fin, user_id, nota, job_item_id, is_automatic
    ) VALUES (
      _job.business_id, 'negro', _consumo, NEW.cantidad,
      CASE WHEN NEW.cantidad > 0 THEN _consumo / NEW.cantidad ELSE 0 END,
      CURRENT_DATE, CURRENT_DATE, _job.user_id,
      CASE WHEN NEW.es_full THEN 'Auto: B/N Full' ELSE 'Auto: B/N' END,
      NEW.id, true
    );
  ELSE
    _colores := NEW.colores_seleccionados;
    IF _colores IS NULL OR array_length(_colores, 1) IS NULL THEN
      IF NEW.printer_id IS NOT NULL THEN
        SELECT colores INTO _printer FROM public.print_printers WHERE id = NEW.printer_id;
        IF _printer IS NOT NULL THEN
          _colores := _printer.colores;
        END IF;
      END IF;
    END IF;
    IF _colores IS NULL OR array_length(_colores, 1) IS NULL THEN
      _colores := ARRAY['negro','cian','magenta','amarillo'];
    END IF;
    _num_colores := array_length(_colores, 1);
    _consumo_por_color := _consumo / _num_colores;

    INSERT INTO public.print_ink_usage (
      business_id, color, cantidad_consumida, hojas_impresas, costo_por_hoja,
      periodo_inicio, periodo_fin, user_id, nota, job_item_id, is_automatic
    )
    SELECT
      _job.business_id, c, _consumo_por_color, NEW.cantidad,
      CASE WHEN NEW.cantidad > 0 THEN _consumo_por_color / NEW.cantidad ELSE 0 END,
      CURRENT_DATE, CURRENT_DATE, _job.user_id,
      CASE WHEN NEW.es_full THEN 'Auto: Color Full' ELSE 'Auto: Color' END,
      NEW.id, true
    FROM unnest(_colores) AS c;
  END IF;

  RETURN NEW;
END;
$function$;
