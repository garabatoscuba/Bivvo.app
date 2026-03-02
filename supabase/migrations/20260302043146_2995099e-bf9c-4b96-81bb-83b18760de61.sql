
-- Add configurable denominations for low bills fund mode
ALTER TABLE public.cash_register_config
ADD COLUMN IF NOT EXISTS low_bill_denominations integer[] NOT NULL DEFAULT ARRAY[1, 2, 5, 10];

-- Create cash register movements table for insert/extract operations
CREATE TABLE public.cash_register_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id),
  business_id UUID NOT NULL REFERENCES public.businesses(id),
  user_id UUID NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('insertion', 'extraction')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cash_register_movements ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Business members can view movements"
  ON public.cash_register_movements FOR SELECT
  USING (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "Employees can view employer movements"
  ON public.cash_register_movements FOR SELECT
  USING (is_employee_of_business(auth.uid(), business_id));

CREATE POLICY "Business members can insert movements"
  ON public.cash_register_movements FOR INSERT
  WITH CHECK (
    (business_id = get_user_business_id(auth.uid()) OR is_employee_of_business(auth.uid(), business_id))
    AND user_id = auth.uid()
  );

CREATE POLICY "Owner and manager can manage movements"
  ON public.cash_register_movements FOR ALL
  USING (
    (business_id = get_user_business_id(auth.uid()))
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  )
  WITH CHECK (
    (business_id = get_user_business_id(auth.uid()))
    AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

CREATE POLICY "Super admin can manage all"
  ON public.cash_register_movements FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Enable realtime for employee cash view
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_register_movements;
