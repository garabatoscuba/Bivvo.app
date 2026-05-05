
-- ============================================
-- FIX 1: employee_insumo_areas - enable RLS
-- ============================================
ALTER TABLE public.employee_insumo_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view area assignments"
ON public.employee_insumo_areas
FOR SELECT
TO authenticated
USING (
  business_id = public.get_user_business_id(auth.uid())
  OR public.is_super_admin(auth.uid())
  OR public.is_employee_of_business(auth.uid(), business_id)
);

CREATE POLICY "Owner and manager can manage area assignments"
ON public.employee_insumo_areas
FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    business_id = public.get_user_business_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    business_id = public.get_user_business_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
  )
);

-- ============================================
-- FIX 2: branches - scope owner/manager management to own business
-- ============================================
DROP POLICY IF EXISTS "Owner and manager can manage branches" ON public.branches;

CREATE POLICY "Owner and manager can manage branches"
ON public.branches
FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    business_id = public.get_user_business_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    business_id = public.get_user_business_id(auth.uid())
    AND (public.has_role(auth.uid(), 'owner'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role))
  )
);

-- ============================================
-- FIX 3: employee_onboarding_tokens - restrict SELECT
-- Use a SECURITY DEFINER function to validate by token string,
-- then drop the broad "Authenticated can validate tokens" policy.
-- ============================================
CREATE OR REPLACE FUNCTION public.validate_onboarding_token(_token text)
RETURNS TABLE (
  id uuid,
  token text,
  employee_id uuid,
  business_id uuid,
  branch_id uuid,
  expires_at timestamptz,
  used_at timestamptz,
  employee_full_name text,
  business_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.token,
    t.employee_id,
    t.business_id,
    t.branch_id,
    t.expires_at,
    t.used_at,
    e.full_name AS employee_full_name,
    b.name AS business_name
  FROM public.employee_onboarding_tokens t
  LEFT JOIN public.employees e ON e.id = t.employee_id
  LEFT JOIN public.businesses b ON b.id = t.business_id
  WHERE t.token = _token
    AND t.used_at IS NULL
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_onboarding_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_onboarding_token(text) TO anon, authenticated;

DROP POLICY IF EXISTS "Authenticated can validate tokens" ON public.employee_onboarding_tokens;
