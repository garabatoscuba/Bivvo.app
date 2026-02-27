
-- ============================================
-- Módulo Caja: tables
-- ============================================

-- 1. Configuration per branch
CREATE TABLE public.cash_register_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'branch' CHECK (mode IN ('branch', 'employee')),
  opening_type text NOT NULL DEFAULT 'fixed' CHECK (opening_type IN ('fixed', 'small_bills')),
  fixed_opening_amount numeric NOT NULL DEFAULT 0,
  petty_cash_min_alert numeric NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(branch_id)
);

ALTER TABLE public.cash_register_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view cash config"
  ON public.cash_register_config FOR SELECT TO authenticated
  USING (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "Owner and manager can manage cash config"
  ON public.cash_register_config FOR ALL TO authenticated
  USING (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Employees can view employer cash config"
  ON public.cash_register_config FOR SELECT TO authenticated
  USING (is_employee_of_business(auth.uid(), business_id));

CREATE POLICY "Super admin can manage all cash configs"
  ON public.cash_register_config FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- 2. Cash register sessions
CREATE TABLE public.cash_registers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  opening_amount numeric NOT NULL DEFAULT 0,
  expected_cash numeric NOT NULL DEFAULT 0,
  counted_cash numeric,
  difference numeric,
  total_sales_cash numeric NOT NULL DEFAULT 0,
  total_sales_transfer numeric NOT NULL DEFAULT 0,
  total_services_cash numeric NOT NULL DEFAULT 0,
  total_services_transfer numeric NOT NULL DEFAULT 0,
  notes text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_registers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cash registers"
  ON public.cash_registers FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own cash register"
  ON public.cash_registers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own cash register"
  ON public.cash_registers FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owner and manager can manage branch cash registers"
  ON public.cash_registers FOR ALL TO authenticated
  USING (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Employees can view employer cash registers"
  ON public.cash_registers FOR SELECT TO authenticated
  USING (is_employee_of_business(auth.uid(), business_id));

CREATE POLICY "Employees can insert employer cash registers"
  ON public.cash_registers FOR INSERT TO authenticated
  WITH CHECK (is_employee_of_business(auth.uid(), business_id) AND user_id = auth.uid());

CREATE POLICY "Employees can update own employer cash register"
  ON public.cash_registers FOR UPDATE TO authenticated
  USING (is_employee_of_business(auth.uid(), business_id) AND user_id = auth.uid());

CREATE POLICY "Super admin can manage all cash registers"
  ON public.cash_registers FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- 3. Petty cash fund per branch
CREATE TABLE public.petty_cash (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE UNIQUE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  balance numeric NOT NULL DEFAULT 0,
  min_alert numeric NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.petty_cash ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view petty cash"
  ON public.petty_cash FOR SELECT TO authenticated
  USING (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "Owner and manager can manage petty cash"
  ON public.petty_cash FOR ALL TO authenticated
  USING (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Employees can view employer petty cash"
  ON public.petty_cash FOR SELECT TO authenticated
  USING (is_employee_of_business(auth.uid(), business_id));

CREATE POLICY "Super admin can manage all petty cash"
  ON public.petty_cash FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- 4. Petty cash movements
CREATE TABLE public.petty_cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  petty_cash_id uuid NOT NULL REFERENCES public.petty_cash(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  movement_type text NOT NULL CHECK (movement_type IN ('deposit', 'withdrawal')),
  amount numeric NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.petty_cash_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view petty cash movements"
  ON public.petty_cash_movements FOR SELECT TO authenticated
  USING (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "Owner and manager can manage petty cash movements"
  ON public.petty_cash_movements FOR ALL TO authenticated
  USING (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Employees can view employer petty cash movements"
  ON public.petty_cash_movements FOR SELECT TO authenticated
  USING (is_employee_of_business(auth.uid(), business_id));

CREATE POLICY "Employees can insert employer petty cash movements"
  ON public.petty_cash_movements FOR INSERT TO authenticated
  WITH CHECK (is_employee_of_business(auth.uid(), business_id) AND user_id = auth.uid());

CREATE POLICY "Super admin can manage all petty cash movements"
  ON public.petty_cash_movements FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Trigger for updated_at on config and petty_cash
CREATE TRIGGER update_cash_register_config_updated_at
  BEFORE UPDATE ON public.cash_register_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_petty_cash_updated_at
  BEFORE UPDATE ON public.petty_cash
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cash_registers_updated_at
  BEFORE UPDATE ON public.cash_registers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
