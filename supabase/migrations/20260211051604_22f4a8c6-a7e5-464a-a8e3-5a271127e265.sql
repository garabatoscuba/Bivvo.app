
-- Create a function that handles new user signup: creates a business and profile automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_business_id UUID;
  new_branch_id UUID;
  user_name TEXT;
BEGIN
  -- Get the full_name from user metadata, fallback to email
  user_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));

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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
