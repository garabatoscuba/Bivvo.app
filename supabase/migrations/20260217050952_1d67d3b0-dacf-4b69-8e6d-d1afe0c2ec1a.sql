
-- Add subscription fields to businesses
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz DEFAULT (now() + interval '14 days'),
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'trial',
  ADD COLUMN IF NOT EXISTS max_branches integer DEFAULT 1;

-- Set trial_ends_at for existing businesses that don't have it
UPDATE public.businesses SET trial_ends_at = created_at + interval '14 days' WHERE trial_ends_at IS NULL;
