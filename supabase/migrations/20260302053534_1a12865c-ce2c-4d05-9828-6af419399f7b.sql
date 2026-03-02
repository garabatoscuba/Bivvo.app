
-- Create treasury_pending_entries table
CREATE TABLE public.treasury_pending_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  employee_user_id UUID NOT NULL,
  cash_register_id UUID NOT NULL REFERENCES public.cash_registers(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS: only owner of the business can read/write
ALTER TABLE public.treasury_pending_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage pending entries"
  ON public.treasury_pending_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = treasury_pending_entries.business_id
        AND b.owner_id = public.get_user_profile_id(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.businesses b
      WHERE b.id = treasury_pending_entries.business_id
        AND b.owner_id = public.get_user_profile_id(auth.uid())
    )
  );

-- Allow employees to INSERT pending entries (when closing their register)
CREATE POLICY "Employees can insert pending entries"
  ON public.treasury_pending_entries
  FOR INSERT
  WITH CHECK (
    employee_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.auth_user_id = auth.uid()
        AND e.business_id = treasury_pending_entries.business_id
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.treasury_pending_entries;
