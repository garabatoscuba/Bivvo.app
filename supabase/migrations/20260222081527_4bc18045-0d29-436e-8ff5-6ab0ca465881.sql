-- Allow users to view their own employee record by matching their profile email
CREATE POLICY "Users can view own employee record by email"
ON public.employees FOR SELECT
USING (
  email = (SELECT p.email FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1)
);
