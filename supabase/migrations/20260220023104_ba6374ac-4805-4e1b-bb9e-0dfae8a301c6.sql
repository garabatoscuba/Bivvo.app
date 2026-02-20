
-- Update default plan_type for new businesses to 'free'
ALTER TABLE public.businesses ALTER COLUMN plan_type SET DEFAULT 'free';

-- Update existing 'trial' plan_type businesses to 'free' if their trial has expired
-- Keep active trials as-is for now
UPDATE public.businesses SET plan_type = 'free' WHERE plan_type = 'trial' AND (trial_ends_at IS NULL OR trial_ends_at < now());

-- Update 'mvp' to 'basic' for existing paid plans
UPDATE public.businesses SET plan_type = 'basic' WHERE plan_type = 'mvp';
