
-- Allow users to see branches of ALL businesses they own (not just current one)
DROP POLICY IF EXISTS "Business members can view their branches" ON public.branches;

CREATE POLICY "Business members can view their branches"
ON public.branches FOR SELECT
USING (
  business_id = get_user_business_id(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = branches.business_id
    AND b.owner_id = get_user_profile_id(auth.uid())
  )
);
