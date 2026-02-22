-- Allow business owners/managers to view profiles of employees in their business (cross-business email match)
CREATE POLICY "Owner can view employee profiles by email"
ON public.profiles FOR SELECT
USING (
  (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  AND email IN (
    SELECT e.email FROM public.employees e 
    WHERE e.business_id = get_user_business_id(auth.uid()) 
    AND e.email IS NOT NULL
  )
);