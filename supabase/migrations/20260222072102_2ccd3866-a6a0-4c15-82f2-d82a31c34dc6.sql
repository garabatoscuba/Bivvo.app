
-- Tabla para tokens de onboarding de empleados
CREATE TABLE public.employee_onboarding_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  position text NOT NULL DEFAULT 'seller',
  created_by uuid NOT NULL,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '72 hours'),
  used_at timestamp with time zone,
  used_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_onboarding_tokens ENABLE ROW LEVEL SECURITY;

-- Owner/manager can create and view tokens for their business
CREATE POLICY "Owner and manager can manage onboarding tokens"
ON public.employee_onboarding_tokens
FOR ALL
USING (
  (business_id = get_user_business_id(auth.uid()))
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  (business_id = get_user_business_id(auth.uid()))
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

-- Super admin full access
CREATE POLICY "Super admin can manage all onboarding tokens"
ON public.employee_onboarding_tokens
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Anyone authenticated can read a specific token (needed for onboarding page)
CREATE POLICY "Authenticated users can view valid tokens"
ON public.employee_onboarding_tokens
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Anyone authenticated can update (mark as used) their own token
CREATE POLICY "Authenticated users can mark token as used"
ON public.employee_onboarding_tokens
FOR UPDATE
USING (auth.uid() IS NOT NULL AND used_by IS NULL)
WITH CHECK (used_by = auth.uid());
