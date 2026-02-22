
-- Add email column to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email text;

-- Multi-branch assignment table
CREATE TABLE public.employee_branch_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, branch_id)
);

ALTER TABLE public.employee_branch_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view assignments"
  ON public.employee_branch_assignments FOR SELECT
  USING (get_branch_business_id(branch_id) = get_user_business_id(auth.uid()));

CREATE POLICY "Owner and manager can manage assignments"
  ON public.employee_branch_assignments FOR ALL
  USING (
    (get_branch_business_id(branch_id) = get_user_business_id(auth.uid()))
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    (get_branch_business_id(branch_id) = get_user_business_id(auth.uid()))
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Super admin can manage all assignments"
  ON public.employee_branch_assignments FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Employee evaluations table
CREATE TABLE public.employee_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  evaluated_by uuid NOT NULL,
  evaluation_month date NOT NULL, -- first day of month
  skills jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{category, name, score, hidden}]
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, evaluation_month)
);

ALTER TABLE public.employee_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view evaluations"
  ON public.employee_evaluations FOR SELECT
  USING (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "Owner and manager can manage evaluations"
  ON public.employee_evaluations FOR ALL
  USING (
    (business_id = get_user_business_id(auth.uid()))
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    (business_id = get_user_business_id(auth.uid()))
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Super admin can manage all evaluations"
  ON public.employee_evaluations FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER update_employee_evaluations_updated_at
  BEFORE UPDATE ON public.employee_evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
