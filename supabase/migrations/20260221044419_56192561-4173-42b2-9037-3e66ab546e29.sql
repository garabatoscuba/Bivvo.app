
-- Fix: owner_id is profile.id, not auth.users.id
-- Drop broken policies
DROP POLICY IF EXISTS "Users can view their own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Users can update their own businesses" ON public.businesses;

-- Recreate with correct comparison
CREATE POLICY "Users can view their owned businesses"
ON public.businesses FOR SELECT
USING (owner_id = get_user_profile_id(auth.uid()));

CREATE POLICY "Users can update their owned businesses"
ON public.businesses FOR UPDATE
USING (owner_id = get_user_profile_id(auth.uid()));
