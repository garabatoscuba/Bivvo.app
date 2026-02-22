-- Allow employees to view their own evaluations by matching email
-- This is needed because an employee (caminalotv) may belong to a different business_id 
-- in profiles, but have an employee record in another business
CREATE POLICY "Employees can view own evaluations by email"
ON public.employee_evaluations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.email = e.email
    WHERE e.id = employee_evaluations.employee_id
      AND p.user_id = auth.uid()
  )
);