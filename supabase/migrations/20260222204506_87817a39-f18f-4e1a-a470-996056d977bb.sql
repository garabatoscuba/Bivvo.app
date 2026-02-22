
-- Table to store daily copy sales per employee
CREATE TABLE public.daily_copies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  cash_amount NUMERIC NOT NULL DEFAULT 0,
  transfer_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(branch_id, user_id, date)
);

ALTER TABLE public.daily_copies ENABLE ROW LEVEL SECURITY;

-- Employees can manage their own daily copies
CREATE POLICY "Users can view own daily copies"
ON public.daily_copies FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own daily copies"
ON public.daily_copies FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own daily copies"
ON public.daily_copies FOR UPDATE
USING (user_id = auth.uid());

-- Employees can manage copies for employer
CREATE POLICY "Employees can manage employer daily copies"
ON public.daily_copies FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.email = e.email
    WHERE p.user_id = auth.uid()
    AND e.business_id = daily_copies.business_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.employees e
    JOIN public.profiles p ON p.email = e.email
    WHERE p.user_id = auth.uid()
    AND e.business_id = daily_copies.business_id
  )
);

-- Owner/manager can view all copies
CREATE POLICY "Owner and manager can manage daily copies"
ON public.daily_copies FOR ALL
USING (
  business_id = get_user_business_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  business_id = get_user_business_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- Super admin
CREATE POLICY "Super admin can manage all daily copies"
ON public.daily_copies FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_daily_copies_updated_at
BEFORE UPDATE ON public.daily_copies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
