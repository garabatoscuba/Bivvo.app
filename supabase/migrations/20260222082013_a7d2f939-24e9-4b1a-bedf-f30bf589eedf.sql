-- Create a security definer function to get profile info by email list
-- This avoids RLS recursion issues
CREATE OR REPLACE FUNCTION public.get_profiles_by_emails(emails text[])
RETURNS TABLE(id uuid, email text, user_id uuid, branch_id uuid, business_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email, p.user_id, p.branch_id, p.business_id
  FROM public.profiles p
  WHERE p.email = ANY(emails);
$$;