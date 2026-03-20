
ALTER TABLE public.plan_requests ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;
ALTER TABLE public.business_requests ADD COLUMN IF NOT EXISTS is_free boolean NOT NULL DEFAULT false;
