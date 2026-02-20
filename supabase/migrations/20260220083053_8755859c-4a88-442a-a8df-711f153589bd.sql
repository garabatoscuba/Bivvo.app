
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_name TEXT;
  old_profile RECORD;
  new_biz_id UUID;
  new_branch_id UUID;
  new_profile_id UUID;
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

  -- Create default trial business
  INSERT INTO public.businesses (name, owner_id)
  VALUES ('Negocio de prueba', NULL)
  RETURNING id INTO new_biz_id;

  -- Create main branch
  INSERT INTO public.branches (business_id, name, is_main)
  VALUES (new_biz_id, 'Principal', true)
  RETURNING id INTO new_branch_id;

  -- Create profile linked to business and branch
  INSERT INTO public.profiles (user_id, full_name, email, business_id, branch_id, plan_type, subscription_status)
  VALUES (NEW.id, user_name, NEW.email, new_biz_id, new_branch_id, 'free', 'active')
  RETURNING id INTO new_profile_id;

  -- Now set the business owner_id to the profile id
  UPDATE public.businesses SET owner_id = new_profile_id WHERE id = new_biz_id;

  -- Assign owner role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'owner');

  RETURN NEW;
END;
$function$;
