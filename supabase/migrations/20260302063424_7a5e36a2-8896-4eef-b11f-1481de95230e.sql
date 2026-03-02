
-- Table to track business periods for Layer 2 reset
CREATE TABLE public.business_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  ended_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.business_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage periods"
  ON public.business_periods FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'owner') AND business_id = get_user_business_id(auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'owner') AND business_id = get_user_business_id(auth.uid()));

CREATE POLICY "Super admin can manage all periods"
  ON public.business_periods FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Add dashboard_reset_at to businesses for Layer 1 visual reset
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS dashboard_reset_at timestamp with time zone;
