
-- Fix handle_new_user to clean up orphaned data from previously deleted users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_business_id UUID;
  new_branch_id UUID;
  user_name TEXT;
  old_profile RECORD;
BEGIN
  -- Get the full_name from user metadata, fallback to email
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

  -- Clean up any orphaned data from a previously deleted user with the same email
  -- Find old profile by email (could be from a deleted auth user)
  FOR old_profile IN
    SELECT p.id, p.user_id, p.business_id FROM public.profiles p WHERE p.email = NEW.email AND p.user_id != NEW.id
  LOOP
    -- Delete orphaned user_roles
    DELETE FROM public.user_roles WHERE user_id = old_profile.user_id;
    -- Delete orphaned profile
    DELETE FROM public.profiles WHERE id = old_profile.id;
  END LOOP;

  -- Create a default business
  INSERT INTO public.businesses (name, owner_id)
  VALUES (user_name || '''s Business', NULL)
  RETURNING id INTO new_business_id;

  -- Create a default main branch
  INSERT INTO public.branches (business_id, name, is_main)
  VALUES (new_business_id, 'Principal', true)
  RETURNING id INTO new_branch_id;

  -- Create the profile
  INSERT INTO public.profiles (user_id, full_name, email, business_id, branch_id)
  VALUES (NEW.id, user_name, NEW.email, new_business_id, new_branch_id);

  -- Update business owner
  UPDATE public.businesses SET owner_id = (SELECT id FROM public.profiles WHERE user_id = NEW.id) WHERE id = new_business_id;

  -- Assign owner role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'owner');

  RETURN NEW;
END;
$function$;
