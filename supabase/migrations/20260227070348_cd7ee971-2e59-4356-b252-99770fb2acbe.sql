
-- The "Restricted token visibility" is now redundant since "Authenticated can validate tokens" 
-- covers all authenticated users. Keep it simple with just the one permissive policy.
DROP POLICY IF EXISTS "Restricted token visibility" ON public.employee_onboarding_tokens;
