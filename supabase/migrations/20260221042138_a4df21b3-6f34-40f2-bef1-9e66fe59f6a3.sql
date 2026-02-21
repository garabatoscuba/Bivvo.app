
-- Table for business/branch creation requests pending admin approval
CREATE TABLE public.business_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  request_type TEXT NOT NULL DEFAULT 'business', -- 'business' or 'branch'
  business_name TEXT,
  business_type TEXT DEFAULT 'store',
  branch_name TEXT,
  branch_business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  admin_notes TEXT,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.business_requests ENABLE ROW LEVEL SECURITY;

-- Users can create their own requests
CREATE POLICY "Users can create own business requests"
  ON public.business_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can view their own requests
CREATE POLICY "Users can view own business requests"
  ON public.business_requests FOR SELECT
  USING (user_id = auth.uid());

-- Super admin can manage all requests
CREATE POLICY "Super admin can manage all business requests"
  ON public.business_requests FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_business_requests_updated_at
  BEFORE UPDATE ON public.business_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
