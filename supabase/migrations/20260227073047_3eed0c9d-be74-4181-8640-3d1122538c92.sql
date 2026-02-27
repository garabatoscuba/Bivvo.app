
-- Business-level evaluation template (categories + skills structure)
CREATE TABLE public.evaluation_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id)
);

ALTER TABLE public.evaluation_templates ENABLE ROW LEVEL SECURITY;

-- Owner/manager can manage
CREATE POLICY "Owner and manager can manage evaluation templates"
  ON public.evaluation_templates FOR ALL
  USING (
    business_id = get_user_business_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  )
  WITH CHECK (
    business_id = get_user_business_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
  );

-- Business members can view
CREATE POLICY "Business members can view evaluation templates"
  ON public.evaluation_templates FOR SELECT
  USING (business_id = get_user_business_id(auth.uid()));

-- Super admin
CREATE POLICY "Super admin can manage all evaluation templates"
  ON public.evaluation_templates FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Updated_at trigger
CREATE TRIGGER update_evaluation_templates_updated_at
  BEFORE UPDATE ON public.evaluation_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
