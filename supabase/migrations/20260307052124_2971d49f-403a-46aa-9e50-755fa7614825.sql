
-- accounting_expenses
CREATE TABLE public.accounting_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  expense_type TEXT NOT NULL DEFAULT 'fixed',
  frequency TEXT,
  category_id UUID REFERENCES public.treasury_categories(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  due_date DATE,
  paid_at TIMESTAMPTZ,
  description TEXT,
  receipt_url TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accounting_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage accounting_expenses"
  ON public.accounting_expenses FOR ALL TO authenticated
  USING (business_id IN (SELECT business_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT business_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Super admin full access accounting_expenses"
  ON public.accounting_expenses FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- accounting_assets
CREATE TABLE public.accounting_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  code TEXT,
  description TEXT NOT NULL,
  acquisition_date DATE,
  supplier TEXT,
  acquisition_cost NUMERIC NOT NULL DEFAULT 0,
  adjusted_cost NUMERIC NOT NULL DEFAULT 0,
  asset_class TEXT NOT NULL DEFAULT 'tools',
  location TEXT,
  responsible TEXT,
  condition TEXT NOT NULL DEFAULT 'in_use',
  state TEXT NOT NULL DEFAULT 'good',
  quantity INT NOT NULL DEFAULT 1,
  retirement_date DATE,
  observations TEXT,
  depreciation_method TEXT DEFAULT 'straight_line',
  useful_life_months INT,
  residual_value NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accounting_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage accounting_assets"
  ON public.accounting_assets FOR ALL TO authenticated
  USING (business_id IN (SELECT business_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (business_id IN (SELECT business_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Super admin full access accounting_assets"
  ON public.accounting_assets FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- accounting_asset_interventions
CREATE TABLE public.accounting_asset_interventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.accounting_assets(id) ON DELETE CASCADE,
  intervention_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT NOT NULL,
  cost NUMERIC NOT NULL DEFAULT 0,
  intervention_type TEXT NOT NULL DEFAULT 'expense',
  responsible TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.accounting_asset_interventions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage accounting_asset_interventions"
  ON public.accounting_asset_interventions FOR ALL TO authenticated
  USING (asset_id IN (SELECT id FROM public.accounting_assets WHERE business_id IN (SELECT business_id FROM public.profiles WHERE user_id = auth.uid())))
  WITH CHECK (asset_id IN (SELECT id FROM public.accounting_assets WHERE business_id IN (SELECT business_id FROM public.profiles WHERE user_id = auth.uid())));

CREATE POLICY "Super admin full access accounting_asset_interventions"
  ON public.accounting_asset_interventions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));
