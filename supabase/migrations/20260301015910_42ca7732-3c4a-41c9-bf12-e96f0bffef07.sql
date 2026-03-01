
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_name TEXT;
  old_profile RECORD;
  new_biz_id UUID;
  new_branch_id UUID;
  new_profile_id UUID;
  is_bivoo BOOLEAN;
BEGIN
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
  is_bivoo := NEW.email LIKE '%@bivoo.app';

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

  IF is_bivoo THEN
    -- @bivoo.app accounts: create profile WITHOUT business, branch, or owner role
    INSERT INTO public.profiles (user_id, full_name, email, business_id, branch_id, plan_type, subscription_status, onboarding_completed)
    VALUES (NEW.id, user_name, NEW.email, NULL, NULL, 'free', 'active', true)
    RETURNING id INTO new_profile_id;

    -- No business creation, no owner role. Role is assigned by the employer later.
  ELSE
    -- Regular users: create trial business + owner role
    INSERT INTO public.businesses (name, owner_id)
    VALUES ('Negocio de prueba', NULL)
    RETURNING id INTO new_biz_id;

    INSERT INTO public.branches (business_id, name, is_main)
    VALUES (new_biz_id, 'Principal', true)
    RETURNING id INTO new_branch_id;

    INSERT INTO public.profiles (user_id, full_name, email, business_id, branch_id, plan_type, subscription_status)
    VALUES (NEW.id, user_name, NEW.email, new_biz_id, new_branch_id, 'free', 'active')
    RETURNING id INTO new_profile_id;

    UPDATE public.businesses SET owner_id = new_profile_id WHERE id = new_biz_id;

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner');
  END IF;

  RETURN NEW;
END;
$$;
