
-- Table to track feature usage for AI recommendations
CREATE TABLE public.assistant_feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL,
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  use_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(business_id, user_id, feature_key)
);

ALTER TABLE public.assistant_feature_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own feature usage"
  ON public.assistant_feature_usage FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can upsert own feature usage"
  ON public.assistant_feature_usage FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own feature usage"
  ON public.assistant_feature_usage FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Table for Super Admin configurable context actions
CREATE TABLE public.assistant_context_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Zap',
  action_type TEXT NOT NULL DEFAULT 'custom',
  action_payload JSONB NOT NULL DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assistant_context_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read active context actions"
  ON public.assistant_context_actions FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Super admins can manage context actions"
  ON public.assistant_context_actions FOR ALL
  TO authenticated
  USING (public.is_super_admin(auth.uid()));
