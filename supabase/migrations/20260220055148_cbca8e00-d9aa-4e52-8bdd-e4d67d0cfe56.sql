
-- Fix: Allow authenticated owners to INSERT new businesses
CREATE POLICY "Owners can create businesses"
ON public.businesses
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'owner'::app_role) AND owner_id = (SELECT id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1)
);
