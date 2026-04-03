
CREATE OR REPLACE FUNCTION public.get_profiles_by_user_ids(user_ids uuid[])
RETURNS TABLE(id uuid, user_id uuid, branch_id uuid, business_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.user_id, p.branch_id, p.business_id
  FROM public.profiles p
  WHERE p.user_id = ANY(user_ids);
$$;
