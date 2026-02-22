
-- Service categories (predefined + custom)
CREATE TABLE public.service_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view service categories"
  ON public.service_categories FOR SELECT
  USING (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "Owner and manager can manage service categories"
  ON public.service_categories FOR ALL
  USING (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')))
  WITH CHECK (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));

CREATE POLICY "Super admin can manage all service categories"
  ON public.service_categories FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE TRIGGER update_service_categories_updated_at
  BEFORE UPDATE ON public.service_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Service entries (each service performed)
CREATE TABLE public.service_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_type TEXT NOT NULL DEFAULT 'cash',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view service entries"
  ON public.service_entries FOR SELECT
  USING (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "Business members can create service entries"
  ON public.service_entries FOR INSERT
  WITH CHECK (business_id = get_user_business_id(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Owner and manager can manage service entries"
  ON public.service_entries FOR ALL
  USING (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')))
  WITH CHECK (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager')));

CREATE POLICY "Super admin can manage all service entries"
  ON public.service_entries FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Insert default categories for Vision Habana
INSERT INTO public.service_categories (business_id, name, is_default) VALUES
  ('03ab1b9d-c0ff-412c-9b78-c86d320dc41c', 'Juegos de PS4', true),
  ('03ab1b9d-c0ff-412c-9b78-c86d320dc41c', 'Juegos de PC', true),
  ('03ab1b9d-c0ff-412c-9b78-c86d320dc41c', 'Juegos Online', true),
  ('03ab1b9d-c0ff-412c-9b78-c86d320dc41c', 'Windows', true),
  ('03ab1b9d-c0ff-412c-9b78-c86d320dc41c', 'Android', true),
  ('03ab1b9d-c0ff-412c-9b78-c86d320dc41c', 'iOS', true);
