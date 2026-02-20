
-- Create plan_requests table for client plan solicitations
CREATE TABLE public.plan_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('basic', 'professional')),
  months INTEGER NOT NULL CHECK (months IN (1, 3, 6, 12)),
  price_per_branch NUMERIC NOT NULL,
  total_branches INTEGER NOT NULL DEFAULT 1,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  custom_end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plan_requests ENABLE ROW LEVEL SECURITY;

-- Users can view their own requests
CREATE POLICY "Users can view own plan requests"
ON public.plan_requests
FOR SELECT
USING (user_id = auth.uid());

-- Users can create their own requests
CREATE POLICY "Users can create own plan requests"
ON public.plan_requests
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Super admin can manage all requests
CREATE POLICY "Super admin can manage all plan requests"
ON public.plan_requests
FOR ALL
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_plan_requests_updated_at
BEFORE UPDATE ON public.plan_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
