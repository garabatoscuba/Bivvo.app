
CREATE TABLE public.module_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.platform_modules(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('user', 'business')),
  target_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (module_id, target_type, target_id)
);

ALTER TABLE public.module_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage all module assignments"
  ON public.module_assignments FOR ALL
  TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Users can view own module assignments"
  ON public.module_assignments FOR SELECT
  TO authenticated
  USING (target_type = 'user' AND target_id = auth.uid());

CREATE POLICY "Business members can view business module assignments"
  ON public.module_assignments FOR SELECT
  TO authenticated
  USING (target_type = 'business' AND target_id = get_user_business_id(auth.uid()));
