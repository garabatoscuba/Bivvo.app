
-- Tipo enum para modalidades de salario
CREATE TYPE public.salary_modality_type AS ENUM (
  'fixed',
  'fixed_ladder',
  'fixed_plus_sales_percent',
  'sales_percent_only',
  'profit_percent',
  'fixed_plus_goal_bonus',
  'hourly',
  'custom_mixed'
);

-- Tipo enum para frecuencia de pago
CREATE TYPE public.pay_frequency AS ENUM (
  'daily',
  'weekly',
  'biweekly',
  'monthly'
);

-- Tabla de modalidades configuradas por negocio
CREATE TABLE public.salary_modalities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  modality_type salary_modality_type NOT NULL,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, modality_type)
);

ALTER TABLE public.salary_modalities ENABLE ROW LEVEL SECURITY;

-- Asignación de modalidad + frecuencia a empleado
CREATE TABLE public.employee_salary_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  modality_id UUID NOT NULL REFERENCES public.salary_modalities(id) ON DELETE CASCADE,
  pay_frequency pay_frequency NOT NULL DEFAULT 'monthly',
  base_salary NUMERIC NOT NULL DEFAULT 0,
  config_override JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id)
);

ALTER TABLE public.employee_salary_assignments ENABLE ROW LEVEL SECURITY;

-- RLS para salary_modalities
CREATE POLICY "Owner and manager can manage salary modalities"
ON public.salary_modalities FOR ALL
USING (
  (business_id = get_user_business_id(auth.uid()))
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  (business_id = get_user_business_id(auth.uid()))
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Employees can view employer salary modalities"
ON public.salary_modalities FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM employees e
    JOIN profiles p ON p.email = e.email
    WHERE p.user_id = auth.uid() AND e.business_id = salary_modalities.business_id
  )
);

CREATE POLICY "Super admin can manage all salary modalities"
ON public.salary_modalities FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- RLS para employee_salary_assignments
CREATE POLICY "Owner and manager can manage salary assignments"
ON public.employee_salary_assignments FOR ALL
USING (
  (business_id = get_user_business_id(auth.uid()))
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  (business_id = get_user_business_id(auth.uid()))
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Employees can view own salary assignment"
ON public.employee_salary_assignments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM employees e
    JOIN profiles p ON p.email = e.email
    WHERE p.user_id = auth.uid() AND e.id = employee_salary_assignments.employee_id
  )
);

CREATE POLICY "Super admin can manage all salary assignments"
ON public.employee_salary_assignments FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Triggers updated_at
CREATE TRIGGER update_salary_modalities_updated_at
  BEFORE UPDATE ON public.salary_modalities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_salary_assignments_updated_at
  BEFORE UPDATE ON public.employee_salary_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
