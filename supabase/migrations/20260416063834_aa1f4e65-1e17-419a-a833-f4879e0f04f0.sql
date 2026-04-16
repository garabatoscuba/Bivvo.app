
-- Drop the recursive policies
DROP POLICY IF EXISTS "Anyone can view active store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Anyone can view branches with active storefront" ON public.branches;
DROP POLICY IF EXISTS "Anyone can view businesses with active storefront" ON public.businesses;

-- Create a secure function to list public storefronts
CREATE OR REPLACE FUNCTION public.list_public_storefronts()
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  business_type text,
  keywords text,
  logo_url text,
  hero_image_url text,
  accent_color text,
  schedule jsonb,
  address text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (b.id)
    b.id,
    b.name,
    b.slug,
    b.business_type,
    b.keywords,
    b.logo_url,
    ss.hero_image_url,
    ss.accent_color,
    ss.schedule,
    br.address
  FROM public.businesses b
  JOIN public.branches br ON br.business_id = b.id
  JOIN public.store_settings ss ON ss.branch_id = br.id AND ss.is_active = true
  WHERE b.is_active = true
  ORDER BY b.id, br.is_main DESC;
$$;
