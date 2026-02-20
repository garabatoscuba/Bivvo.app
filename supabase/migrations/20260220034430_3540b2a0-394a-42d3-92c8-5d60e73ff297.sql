
-- PASO 2: Trigger to nullify profile references before deleting a business
CREATE OR REPLACE FUNCTION public.nullify_profiles_on_business_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET business_id = NULL, branch_id = NULL
  WHERE business_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER before_business_delete
  BEFORE DELETE ON public.businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.nullify_profiles_on_business_delete();

-- PASO 3: Fix handle_new_user — no business, no branch, just profile
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

  -- Create profile with NO business, NO branch, free plan
  INSERT INTO public.profiles (user_id, full_name, email, business_id, branch_id, plan_type, subscription_status)
  VALUES (NEW.id, user_name, NEW.email, NULL, NULL, 'free', 'active');

  -- Assign owner role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'owner');

  RETURN NEW;
END;
$$;

-- PASO 4: Remove plan/subscription columns from businesses table
ALTER TABLE public.businesses
  DROP COLUMN IF EXISTS plan_type,
  DROP COLUMN IF EXISTS subscription_status,
  DROP COLUMN IF EXISTS subscription_ends_at,
  DROP COLUMN IF EXISTS trial_ends_at,
  DROP COLUMN IF EXISTS max_branches;

-- Create super admin profile if missing
INSERT INTO public.profiles (user_id, full_name, email, business_id, branch_id, plan_type, subscription_status)
VALUES ('cee48500-804f-4cbe-9026-d4dd8b29b3ca', 'Super Admin', 'garabatoscuba@gmail.com', NULL, NULL, 'free', 'active')
ON CONFLICT (user_id) DO UPDATE SET business_id = NULL, branch_id = NULL;
