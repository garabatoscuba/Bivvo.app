
-- Table to store salary configuration per business (puestos de trabajo y condiciones)
CREATE TABLE public.salary_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  total_positions integer NOT NULL DEFAULT 3,
  -- Conditions stored as JSONB array: [{positions: 3, service_percent: 12}, {positions: 2, service_percent: 33}, {positions: 1, service_percent: 30}]
  conditions jsonb NOT NULL DEFAULT '[{"positions": 3, "service_percent": 12}, {"positions": 2, "service_percent": 33}, {"positions": 1, "service_percent": 30}]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id)
);

ALTER TABLE public.salary_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owner and manager can manage salary config"
ON public.salary_config FOR ALL
USING (
  (business_id = get_user_business_id(auth.uid()))
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
)
WITH CHECK (
  (business_id = get_user_business_id(auth.uid()))
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

CREATE POLICY "Super admin can manage all salary config"
ON public.salary_config FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Employees can view employer salary config"
ON public.salary_config FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.email = e.email
    WHERE p.user_id = auth.uid() AND e.business_id = salary_config.business_id
  )
);

-- Table for product commissions
CREATE TABLE public.product_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  commission_type text NOT NULL DEFAULT 'fixed' CHECK (commission_type IN ('fixed', 'percent')),
  commission_value numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id, product_id)
);

ALTER TABLE public.product_commissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business owner and manager can manage commissions"
ON public.product_commissions FOR ALL
USING (
  (business_id = get_user_business_id(auth.uid()))
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
)
WITH CHECK (
  (business_id = get_user_business_id(auth.uid()))
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

CREATE POLICY "Super admin can manage all commissions"
ON public.product_commissions FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Employees can view employer commissions"
ON public.product_commissions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.email = e.email
    WHERE p.user_id = auth.uid() AND e.business_id = product_commissions.business_id
  )
);

-- Triggers for updated_at
CREATE TRIGGER update_salary_config_updated_at
BEFORE UPDATE ON public.salary_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_product_commissions_updated_at
BEFORE UPDATE ON public.product_commissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default config for Vision Habana
INSERT INTO public.salary_config (business_id, total_positions, conditions)
VALUES (
  '03ab1b9d-c0ff-412c-9b78-c86d320dc41c',
  3,
  '[{"positions": 3, "service_percent": 12}, {"positions": 2, "service_percent": 33}, {"positions": 1, "service_percent": 30}]'::jsonb
);
