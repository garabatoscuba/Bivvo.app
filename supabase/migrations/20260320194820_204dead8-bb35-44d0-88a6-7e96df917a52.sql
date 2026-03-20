
-- Step 1: Drop old check constraint
ALTER TABLE public.plan_requests DROP CONSTRAINT IF EXISTS plan_requests_plan_type_check;

-- Step 2: Rename data in order (professional→enterprise first, then basic→professional)
UPDATE public.plan_requests SET plan_type = 'enterprise' WHERE plan_type = 'professional';
UPDATE public.plan_requests SET plan_type = 'professional' WHERE plan_type = 'basic';

UPDATE public.profiles SET plan_type = 'enterprise' WHERE plan_type = 'professional';
UPDATE public.profiles SET plan_type = 'professional' WHERE plan_type = 'basic';

-- Step 3: Update module_plugin_pricing
UPDATE public.module_plugin_pricing SET plan_type = 'enterprise' WHERE plan_type = 'professional';
UPDATE public.module_plugin_pricing SET plan_type = 'professional' WHERE plan_type = 'basic';

-- Step 4: Update assistant_feature_pricing
UPDATE public.assistant_feature_pricing SET plan_type = 'enterprise' WHERE plan_type = 'professional';
UPDATE public.assistant_feature_pricing SET plan_type = 'professional' WHERE plan_type = 'basic';

-- Step 5: Update partner applies_to_plans arrays
UPDATE public.partners 
SET applies_to_plans = array_replace(applies_to_plans, 'professional', 'enterprise')
WHERE 'professional' = ANY(applies_to_plans);

UPDATE public.partners 
SET applies_to_plans = array_replace(applies_to_plans, 'basic', 'professional')
WHERE 'basic' = ANY(applies_to_plans);

-- Step 6: Update plan_offers applies_to_plans arrays
UPDATE public.plan_offers 
SET applies_to_plans = array_replace(applies_to_plans, 'professional', 'enterprise')
WHERE 'professional' = ANY(applies_to_plans);

UPDATE public.plan_offers 
SET applies_to_plans = array_replace(applies_to_plans, 'basic', 'professional')
WHERE 'basic' = ANY(applies_to_plans);

-- Step 7: Update partner_referrals plan_type
UPDATE public.partner_referrals SET plan_type = 'enterprise' WHERE plan_type = 'professional';
UPDATE public.partner_referrals SET plan_type = 'professional' WHERE plan_type = 'basic';

-- Step 8: Add new check constraint with updated values
ALTER TABLE public.plan_requests ADD CONSTRAINT plan_requests_plan_type_check 
  CHECK (plan_type = ANY (ARRAY['professional'::text, 'enterprise'::text]));
