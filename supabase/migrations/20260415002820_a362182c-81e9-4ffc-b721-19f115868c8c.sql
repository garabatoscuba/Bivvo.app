
-- Add branch_id and created_by to customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id),
  ADD COLUMN IF NOT EXISTS created_by uuid;

-- Add customer_id to service_entries
ALTER TABLE public.service_entries
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_service_entries_customer_id ON public.service_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_branch_id ON public.customers(branch_id);

-- RLS: Allow any authenticated user belonging to the business to insert customers
CREATE POLICY "Business members can insert customers"
ON public.customers
FOR INSERT
TO authenticated
WITH CHECK (
  business_id = public.get_user_business_id(auth.uid())
);

-- RLS: Allow any authenticated user belonging to the business to update customers
CREATE POLICY "Business members can update customers"
ON public.customers
FOR UPDATE
TO authenticated
USING (
  business_id = public.get_user_business_id(auth.uid())
);
