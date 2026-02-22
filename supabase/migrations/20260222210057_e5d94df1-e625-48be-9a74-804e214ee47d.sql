
-- Table to store daily close-out reports per employee
CREATE TABLE public.daily_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.profiles(id),
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Salary breakdown
  active_workers INTEGER NOT NULL DEFAULT 1,
  service_percent NUMERIC NOT NULL DEFAULT 0,
  total_services NUMERIC NOT NULL DEFAULT 0,
  total_copies NUMERIC NOT NULL DEFAULT 0,
  total_commissions NUMERIC NOT NULL DEFAULT 0,
  service_earning NUMERIC NOT NULL DEFAULT 0,
  copies_earning NUMERIC NOT NULL DEFAULT 0,
  commission_earning NUMERIC NOT NULL DEFAULT 0,
  tips NUMERIC NOT NULL DEFAULT 0,
  total_salary NUMERIC NOT NULL DEFAULT 0,
  -- Calculator data
  cash_counted NUMERIC NOT NULL DEFAULT 0,
  service_cash NUMERIC NOT NULL DEFAULT 0,
  service_transfer NUMERIC NOT NULL DEFAULT 0,
  sales_cash NUMERIC NOT NULL DEFAULT 0,
  sales_transfer NUMERIC NOT NULL DEFAULT 0,
  copies_cash NUMERIC NOT NULL DEFAULT 0,
  copies_transfer NUMERIC NOT NULL DEFAULT 0,
  total_expected_cash NUMERIC NOT NULL DEFAULT 0,
  total_transfers NUMERIC NOT NULL DEFAULT 0,
  total_sales_day NUMERIC NOT NULL DEFAULT 0,
  -- Money to deliver = cash_counted - tips (employee keeps tips)
  money_to_deliver NUMERIC NOT NULL DEFAULT 0,
  -- Jornada reference
  jornada_id UUID REFERENCES public.jornadas(id),
  closed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- Employees can insert/view their own reports
CREATE POLICY "Users can insert own daily reports"
  ON public.daily_reports FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own daily reports"
  ON public.daily_reports FOR SELECT
  USING (user_id = auth.uid());

-- Owner and manager can view all reports for their business
CREATE POLICY "Owner and manager can view business reports"
  ON public.daily_reports FOR ALL
  USING (
    (business_id = get_user_business_id(auth.uid()))
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    (business_id = get_user_business_id(auth.uid()))
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  );

-- Super admin
CREATE POLICY "Super admin can manage all daily reports"
  ON public.daily_reports FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Employees can view employer reports
CREATE POLICY "Employees can view employer reports"
  ON public.daily_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      JOIN profiles p ON p.email = e.email
      WHERE p.user_id = auth.uid()
      AND e.business_id = daily_reports.business_id
    )
  );
