
-- 1. Add plan & subscription fields to profiles (plan belongs to user, not business)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_type text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at timestamptz;

-- 2. Migrate existing plan data from businesses to profiles (best effort)
UPDATE public.profiles p
SET 
  plan_type = COALESCE(b.plan_type, 'free'),
  subscription_status = b.subscription_status::text,
  trial_ends_at = b.trial_ends_at,
  subscription_ends_at = b.subscription_ends_at
FROM public.businesses b
WHERE p.business_id = b.id
  AND b.plan_type IS NOT NULL
  AND b.plan_type != 'free';

-- 3. Allow profiles.business_id to be null (free users without a business)
-- It's already nullable, so no change needed.

-- 4. Allow super_admin to update all profiles (needed for soft-delete management)
CREATE POLICY "Super admin can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (is_super_admin(auth.uid()));

-- 5. Allow super_admin to delete profiles (for cleanup after 30 days)
CREATE POLICY "Super admin can delete profiles"
  ON public.profiles
  FOR DELETE
  USING (is_super_admin(auth.uid()));
