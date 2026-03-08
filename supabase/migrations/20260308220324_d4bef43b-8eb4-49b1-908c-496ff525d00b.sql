
-- 1. Add permite_tramos to print_material_types
ALTER TABLE public.print_material_types
  ADD COLUMN IF NOT EXISTS permite_tramos boolean NOT NULL DEFAULT false;

-- 2. Create print_active_sheets table
CREATE TABLE public.print_active_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  material_id uuid NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  tramos_total integer NOT NULL DEFAULT 1,
  tramos_usados integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'activa',
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

-- Unique constraint: only 1 active sheet per material+branch
CREATE UNIQUE INDEX uq_active_sheet_per_material_branch
  ON public.print_active_sheets (material_id, branch_id)
  WHERE status = 'activa';

-- RLS
ALTER TABLE public.print_active_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view active sheets of their business"
  ON public.print_active_sheets FOR SELECT TO authenticated
  USING (business_id = public.get_user_business_id(auth.uid()));

CREATE POLICY "Users can insert active sheets for their business"
  ON public.print_active_sheets FOR INSERT TO authenticated
  WITH CHECK (business_id = public.get_user_business_id(auth.uid()));

CREATE POLICY "Users can update active sheets of their business"
  ON public.print_active_sheets FOR UPDATE TO authenticated
  USING (business_id = public.get_user_business_id(auth.uid()));

-- 3. Trigger: auto-increment tramos on print_job_items insert
CREATE OR REPLACE FUNCTION public.auto_increment_tramos_on_print()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _job RECORD;
  _service RECORD;
  _material RECORD;
  _mat_type RECORD;
  _sheet RECORD;
BEGIN
  -- Get job context
  SELECT business_id, branch_id INTO _job
  FROM public.print_jobs WHERE id = NEW.job_id;
  IF _job IS NULL THEN RETURN NEW; END IF;

  -- Get service to find material
  IF NEW.service_type_id IS NULL THEN RETURN NEW; END IF;
  SELECT material_id INTO _service
  FROM public.print_service_types WHERE id = NEW.service_type_id;
  IF _service IS NULL OR _service.material_id IS NULL THEN RETURN NEW; END IF;

  -- Get material and its type
  SELECT id, material_type_id INTO _material
  FROM public.raw_materials WHERE id = _service.material_id;
  IF _material IS NULL OR _material.material_type_id IS NULL THEN RETURN NEW; END IF;

  -- Check if material type allows tramos
  SELECT permite_tramos INTO _mat_type
  FROM public.print_material_types WHERE id = _material.material_type_id;
  IF _mat_type IS NULL OR _mat_type.permite_tramos = false THEN RETURN NEW; END IF;

  -- Find active sheet for this material + branch
  SELECT id, tramos_total, tramos_usados INTO _sheet
  FROM public.print_active_sheets
  WHERE material_id = _material.id
    AND branch_id = _job.branch_id
    AND status = 'activa'
  LIMIT 1;

  IF _sheet IS NULL THEN RETURN NEW; END IF;

  -- Increment tramos_usados
  UPDATE public.print_active_sheets
  SET tramos_usados = tramos_usados + NEW.cantidad
  WHERE id = _sheet.id;

  -- Check if sheet is now exhausted
  IF (_sheet.tramos_usados + NEW.cantidad) >= _sheet.tramos_total THEN
    UPDATE public.print_active_sheets
    SET status = 'agotada', closed_at = now()
    WHERE id = _sheet.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_increment_tramos
  AFTER INSERT ON public.print_job_items
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_increment_tramos_on_print();
