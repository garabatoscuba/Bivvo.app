
CREATE TABLE public.work_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  inicio TIMESTAMPTZ NOT NULL DEFAULT now(),
  fin TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.work_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner and managers can manage work_sessions"
ON public.work_sessions
FOR ALL
TO authenticated
USING (
  business_id = public.get_user_business_id(auth.uid())
)
WITH CHECK (
  business_id = public.get_user_business_id(auth.uid())
);

CREATE INDEX idx_work_sessions_employee ON public.work_sessions(employee_id);
CREATE INDEX idx_work_sessions_business ON public.work_sessions(business_id);
CREATE INDEX idx_work_sessions_date ON public.work_sessions(inicio DESC);
