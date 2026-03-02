
-- 1. Entradas de Productos (product cost entries from suppliers)
CREATE TABLE public.product_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  sale_price_per_unit NUMERIC NOT NULL DEFAULT 0,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID NOT NULL REFERENCES auth.users(id)
);

ALTER TABLE public.product_entries ENABLE ROW LEVEL SECURITY;

-- Only owner can read
CREATE POLICY "Owner can read product_entries"
  ON public.product_entries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      JOIN public.profiles p ON p.id = b.owner_id
      WHERE b.id = product_entries.business_id AND p.user_id = auth.uid()
    )
  );

-- Only owner can insert
CREATE POLICY "Owner can insert product_entries"
  ON public.product_entries FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.businesses b
      JOIN public.profiles p ON p.id = b.owner_id
      WHERE b.id = product_entries.business_id AND p.user_id = auth.uid()
    )
  );

-- 2. Salarios de Empleados (daily salary records)
CREATE TABLE public.employee_salary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  employee_user_id UUID NOT NULL REFERENCES auth.users(id),
  employee_name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  salary_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT NOT NULL DEFAULT 'pending' CHECK (payment_method IN ('cash', 'transfer', 'pending')),
  jornada_id UUID REFERENCES public.jornadas(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_salary_records ENABLE ROW LEVEL SECURITY;

-- Owner and manager can read
CREATE POLICY "Owner/manager can read salary_records"
  ON public.employee_salary_records FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner')
    AND public.get_user_business_id(auth.uid()) = business_id
    OR
    public.has_role(auth.uid(), 'manager')
    AND public.get_user_business_id(auth.uid()) = business_id
  );

-- System inserts via authenticated user (employee closing shift)
CREATE POLICY "Authenticated can insert own salary_records"
  ON public.employee_salary_records FOR INSERT TO authenticated
  WITH CHECK (
    employee_user_id = auth.uid()
    AND public.get_user_business_id(auth.uid()) = business_id
  );

-- Owner can update payment_method
CREATE POLICY "Owner can update salary_records"
  ON public.employee_salary_records FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner')
    AND public.get_user_business_id(auth.uid()) = business_id
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'owner')
    AND public.get_user_business_id(auth.uid()) = business_id
  );
