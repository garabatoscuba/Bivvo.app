
-- Allow authenticated users to discover active storefronts
CREATE POLICY "Anyone can view active store settings"
ON public.store_settings FOR SELECT TO authenticated
USING (is_active = true);

-- Allow authenticated users to view branches that have an active storefront
CREATE POLICY "Anyone can view branches with active storefront"
ON public.branches FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.store_settings ss
    WHERE ss.branch_id = branches.id AND ss.is_active = true
  )
);

-- Allow authenticated users to view businesses that have an active storefront
CREATE POLICY "Anyone can view businesses with active storefront"
ON public.businesses FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.branches br
    JOIN public.store_settings ss ON ss.branch_id = br.id
    WHERE br.business_id = businesses.id AND ss.is_active = true
  )
);
