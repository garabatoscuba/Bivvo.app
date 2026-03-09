
-- 1. Per-employee material stock table
CREATE TABLE public.employee_material_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  stock NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, material_id)
);

ALTER TABLE public.employee_material_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view employee material stock for their business"
  ON public.employee_material_stock FOR SELECT TO authenticated
  USING (
    business_id IN (SELECT public.get_user_business_id(auth.uid()))
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "Owners and managers can manage employee material stock"
  ON public.employee_material_stock FOR ALL TO authenticated
  USING (
    business_id IN (SELECT public.get_user_business_id(auth.uid()))
    OR public.is_super_admin(auth.uid())
  )
  WITH CHECK (
    business_id IN (SELECT public.get_user_business_id(auth.uid()))
    OR public.is_super_admin(auth.uid())
  );

-- 2. Add admite_color to print_service_types
ALTER TABLE public.print_service_types ADD COLUMN admite_color BOOLEAN NOT NULL DEFAULT false;
