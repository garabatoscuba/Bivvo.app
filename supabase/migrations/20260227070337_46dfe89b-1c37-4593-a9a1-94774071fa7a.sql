
-- Update token visibility: allow any authenticated user to look up a specific token by value
-- (needed for onboarding flow where user validates their invitation token)
DROP POLICY IF EXISTS "Users can view their assigned token" ON public.employee_onboarding_tokens;
CREATE POLICY "Restricted token visibility"
  ON public.employee_onboarding_tokens FOR SELECT
  TO authenticated
  USING (
    -- Business owners/managers can see all their business tokens
    (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
    -- The user who used the token
    OR used_by = auth.uid()
    -- The employee linked to the token
    OR EXISTS (
      SELECT 1 FROM employees e
      JOIN profiles p ON p.email = e.email
      WHERE e.id = employee_onboarding_tokens.employee_id
        AND p.user_id = auth.uid()
    )
  );

-- Also add a permissive policy so any authenticated user can look up tokens
-- This is needed for the onboarding validation flow
CREATE POLICY "Authenticated can validate tokens"
  ON public.employee_onboarding_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
