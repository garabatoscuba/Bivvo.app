
-- Create employees table for HR data
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id),
  contract_number text NOT NULL,
  full_name text NOT NULL,
  age integer,
  ci text NOT NULL,
  license_number text,
  address text,
  position text NOT NULL DEFAULT 'seller',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Business members can view employees
CREATE POLICY "Business members can view employees"
ON public.employees FOR SELECT
USING (business_id = get_user_business_id(auth.uid()));

-- Owner and manager can manage employees
CREATE POLICY "Owner and manager can manage employees"
ON public.employees FOR ALL
USING (
  business_id = get_user_business_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  business_id = get_user_business_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- Super admin can manage all employees
CREATE POLICY "Super admin can manage all employees"
ON public.employees FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Auto-update updated_at
CREATE TRIGGER update_employees_updated_at
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
