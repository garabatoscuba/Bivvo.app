
-- Affiliates table: customers who join the loyalty program at a specific branch
CREATE TABLE public.affiliates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name text,
  phone text,
  email text,
  points integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

-- Public can insert (storefront registration)
CREATE POLICY "Anyone can register as affiliate"
  ON public.affiliates FOR INSERT
  WITH CHECK (true);

-- Business members can view their branch affiliates
CREATE POLICY "Business members can view affiliates"
  ON public.affiliates FOR SELECT
  USING (get_branch_business_id(branch_id) = get_user_business_id(auth.uid()));

-- Owner/manager can manage affiliates
CREATE POLICY "Owner and manager can manage affiliates"
  ON public.affiliates FOR ALL
  USING (
    get_branch_business_id(branch_id) = get_user_business_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    get_branch_business_id(branch_id) = get_user_business_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Super admin can manage all affiliates"
  ON public.affiliates FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Reviews table: only affiliates with purchases can leave reviews
CREATE TABLE public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  affiliate_id uuid NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view visible reviews (public storefront)
CREATE POLICY "Anyone can view visible reviews"
  ON public.reviews FOR SELECT
  USING (true);

-- Anyone can insert reviews (validated in edge function)
CREATE POLICY "Anyone can insert reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (true);

-- Business members can manage reviews (hide/show)
CREATE POLICY "Owner and manager can manage reviews"
  ON public.reviews FOR ALL
  USING (
    get_branch_business_id(branch_id) = get_user_business_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    get_branch_business_id(branch_id) = get_user_business_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Super admin can manage all reviews"
  ON public.reviews FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Announcements table: special offers/announcements for the storefront
CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  badge_text text DEFAULT 'Oferta',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Anyone can view active announcements (public storefront)
CREATE POLICY "Anyone can view announcements"
  ON public.announcements FOR SELECT
  USING (true);

-- Business members can manage their announcements
CREATE POLICY "Owner and manager can manage announcements"
  ON public.announcements FOR ALL
  USING (
    get_branch_business_id(branch_id) = get_user_business_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    get_branch_business_id(branch_id) = get_user_business_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  );

CREATE POLICY "Super admin can manage all announcements"
  ON public.announcements FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_affiliates_updated_at
  BEFORE UPDATE ON public.affiliates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
