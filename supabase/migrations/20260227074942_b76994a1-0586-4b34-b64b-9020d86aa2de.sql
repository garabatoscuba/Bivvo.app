
-- Plan offers/discounts table
CREATE TABLE public.plan_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  applies_to_plans TEXT[] NOT NULL DEFAULT ARRAY['basic', 'professional'],
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'specific')),
  target_user_ids UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.plan_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active offers"
  ON public.plan_offers FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "Super admin can manage all offers"
  ON public.plan_offers FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_plan_offers_updated_at
  BEFORE UPDATE ON public.plan_offers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
