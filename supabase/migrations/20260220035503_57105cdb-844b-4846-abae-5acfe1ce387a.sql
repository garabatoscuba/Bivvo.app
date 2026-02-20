
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_name TEXT;
  old_profile RECORD;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  -- Clean up orphaned profiles from previously deleted users with same email
  FOR old_profile IN
    SELECT p.id, p.user_id FROM public.profiles p WHERE p.email = NEW.email AND p.user_id != NEW.id
  LOOP
    DELETE FROM public.user_roles WHERE user_id = old_profile.user_id;
    DELETE FROM public.profiles WHERE id = old_profile.id;
  END LOOP;

  -- Also clean up any orphaned records for this exact user_id (re-registration)
  DELETE FROM public.user_roles WHERE user_id = NEW.id;
  DELETE FROM public.profiles WHERE user_id = NEW.id;

  -- Create profile with NO business, NO branch, free plan
  INSERT INTO public.profiles (user_id, full_name, email, business_id, branch_id, plan_type, subscription_status)
  VALUES (NEW.id, user_name, NEW.email, NULL, NULL, 'free', 'active');

  -- Assign owner role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'owner');

  RETURN NEW;
END;
$$;
