-- Drop the problematic policy causing infinite recursion
DROP POLICY IF EXISTS "Owner can view employee profiles by email" ON public.profiles;