
-- Security definer function to check if a user is employee of a business (avoids recursion)
CREATE OR REPLACE FUNCTION public.is_employee_of_business(_user_id uuid, _business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM employees e
    JOIN profiles p ON p.email = e.email
    WHERE p.user_id = _user_id
      AND e.business_id = _business_id
  )
$$;

-- Allow employees to see their coworkers in the same business
CREATE POLICY "Employees can view coworkers"
  ON public.employees FOR SELECT
  USING (public.is_employee_of_business(auth.uid(), business_id));
