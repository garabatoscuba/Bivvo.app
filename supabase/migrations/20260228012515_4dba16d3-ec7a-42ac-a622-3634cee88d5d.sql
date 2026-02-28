ALTER TABLE public.employees ADD COLUMN auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX idx_employees_auth_user_id ON public.employees(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Allow @bivoo.app users to find their own employee record by auth_user_id
CREATE POLICY "Users can view own employee record by auth_user_id"
ON public.employees FOR SELECT
USING (auth_user_id = auth.uid());