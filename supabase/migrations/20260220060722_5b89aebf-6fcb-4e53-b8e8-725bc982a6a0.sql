
-- Drop the restrictive INSERT policy
DROP POLICY IF EXISTS "Owners can create businesses" ON public.businesses;

-- Recreate as PERMISSIVE so owners can actually insert
CREATE POLICY "Owners can create businesses"
ON public.businesses FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role)
  AND owner_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);
