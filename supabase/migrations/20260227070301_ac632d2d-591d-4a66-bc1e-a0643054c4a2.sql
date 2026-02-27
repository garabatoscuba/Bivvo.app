
-- 1. Remove overly permissive INSERT policies on businesses
DROP POLICY IF EXISTS "Allow anon insert test" ON public.businesses;
DROP POLICY IF EXISTS "Allow authenticated insert" ON public.businesses;

-- 2. Replace "Anyone can insert reviews" with authenticated-only policy
DROP POLICY IF EXISTS "Anyone can insert reviews" ON public.reviews;
CREATE POLICY "Authenticated users can insert reviews"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 3. Replace "Anyone can register as affiliate" with authenticated-only policy
DROP POLICY IF EXISTS "Anyone can register as affiliate" ON public.affiliates;
CREATE POLICY "Authenticated users can register as affiliate"
  ON public.affiliates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 4. Restrict onboarding tokens visibility to business owners/managers only (the ALL policy already covers them, but the broad SELECT is dangerous)
DROP POLICY IF EXISTS "Authenticated users can view valid tokens" ON public.employee_onboarding_tokens;
CREATE POLICY "Users can view their assigned token"
  ON public.employee_onboarding_tokens FOR SELECT
  TO authenticated
  USING (
    (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
    OR used_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM employees e
      JOIN profiles p ON p.email = e.email
      WHERE e.id = employee_onboarding_tokens.employee_id
        AND p.user_id = auth.uid()
    )
  );
