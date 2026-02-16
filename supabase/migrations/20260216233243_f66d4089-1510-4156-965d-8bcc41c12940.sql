
-- Drop the overly permissive "Business members can manage customers" policy
DROP POLICY IF EXISTS "Business members can manage customers" ON public.customers;

-- Keep the SELECT policy for all business members (needed for POS lookups)
-- "Business members can view customers" already exists

-- Add INSERT/UPDATE/DELETE restricted to owner and manager roles only
CREATE POLICY "Owner and manager can insert customers"
ON public.customers
FOR INSERT
WITH CHECK (
  business_id = get_user_business_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

CREATE POLICY "Owner and manager can update customers"
ON public.customers
FOR UPDATE
USING (
  business_id = get_user_business_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);

CREATE POLICY "Owner and manager can delete customers"
ON public.customers
FOR DELETE
USING (
  business_id = get_user_business_id(auth.uid())
  AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
);
