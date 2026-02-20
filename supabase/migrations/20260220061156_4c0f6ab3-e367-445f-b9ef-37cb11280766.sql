
-- Create a security definer function to get profile id safely
CREATE OR REPLACE FUNCTION public.get_user_profile_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = _user_id LIMIT 1
$$;

-- Drop and recreate the INSERT policy using the safe function
DROP POLICY IF EXISTS "Owners can create businesses" ON public.businesses;

CREATE POLICY "Owners can create businesses"
ON public.businesses FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role)
  AND owner_id = get_user_profile_id(auth.uid())
);
