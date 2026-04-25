-- Permitir a usuarios autenticados crear su propio negocio (asignándose como owner)
CREATE POLICY "Users can create their own businesses"
ON public.businesses
FOR INSERT
TO authenticated
WITH CHECK (owner_id = public.get_user_profile_id(auth.uid()));