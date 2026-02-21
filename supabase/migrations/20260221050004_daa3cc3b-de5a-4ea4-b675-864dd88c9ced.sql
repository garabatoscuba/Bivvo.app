
-- 1. Add 'affiliated' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'affiliated';

-- 2. Add user_type to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_type text NOT NULL DEFAULT 'internal';

-- 3. Create affiliations table
CREATE TABLE public.affiliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, branch_id)
);

-- Enable RLS
ALTER TABLE public.affiliations ENABLE ROW LEVEL SECURITY;

-- Users can view their own affiliations
CREATE POLICY "Users can view own affiliations"
ON public.affiliations FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own affiliation
CREATE POLICY "Users can create own affiliation"
ON public.affiliations FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Business owners/managers can view affiliations for their business
CREATE POLICY "Business members can view affiliations"
ON public.affiliations FOR SELECT
USING (business_id = get_user_business_id(auth.uid()));

-- Business owners/managers can manage affiliations
CREATE POLICY "Owner and manager can manage affiliations"
ON public.affiliations FOR ALL
USING (
  (business_id = get_user_business_id(auth.uid()))
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  (business_id = get_user_business_id(auth.uid()))
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- Super admin full access
CREATE POLICY "Super admin can manage all affiliations"
ON public.affiliations FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));
