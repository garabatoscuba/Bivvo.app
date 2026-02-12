-- Add RLS policy so business owners can view profiles of their business members
CREATE POLICY "Owner can view business member roles"
ON public.user_roles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = user_roles.user_id
    AND p.business_id = get_user_business_id(auth.uid())
  )
  AND has_role(auth.uid(), 'owner')
);

-- Allow owners to manage roles of their business members
CREATE POLICY "Owner can manage business member roles"
ON public.user_roles
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = user_roles.user_id
    AND p.business_id = get_user_business_id(auth.uid())
  )
  AND has_role(auth.uid(), 'owner')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = user_roles.user_id
    AND p.business_id = get_user_business_id(auth.uid())
  )
  AND has_role(auth.uid(), 'owner')
  AND role != 'super_admin'
);

-- Allow owners to view all profiles in their business (not just their own)
-- The existing policy only lets owners view, let's also allow managers
CREATE POLICY "Manager can view business profiles"
ON public.profiles
FOR SELECT
USING (
  business_id = get_user_business_id(auth.uid())
  AND has_role(auth.uid(), 'manager')
);