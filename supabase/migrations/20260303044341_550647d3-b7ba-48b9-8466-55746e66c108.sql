
-- =============================================
-- 1. ASSISTANT FEATURES
-- =============================================
CREATE TABLE public.assistant_features (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT NOT NULL DEFAULT 'Sparkles',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assistant_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read assistant features"
  ON public.assistant_features FOR SELECT USING (true);

CREATE POLICY "Super admin manages assistant features"
  ON public.assistant_features FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_assistant_features_updated_at
  BEFORE UPDATE ON public.assistant_features
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.assistant_features (key, name, description, icon, sort_order) VALUES
  ('notifications', 'Notificaciones', 'Alertas y avisos en tiempo real dentro del chat', 'Bell', 0),
  ('assistant_chat', 'Asistente IA', 'Chat conversacional con inteligencia artificial', 'MessageSquare', 1),
  ('context_menu', 'Menú Contextual', 'Acciones rápidas desde el botón del asistente', 'Menu', 2);

-- =============================================
-- 2. ASSISTANT FEATURE ROLES
-- =============================================
CREATE TABLE public.assistant_feature_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_id UUID NOT NULL REFERENCES public.assistant_features(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  is_allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(feature_id, role)
);

ALTER TABLE public.assistant_feature_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feature roles"
  ON public.assistant_feature_roles FOR SELECT USING (true);

CREATE POLICY "Super admin manages feature roles"
  ON public.assistant_feature_roles FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

INSERT INTO public.assistant_feature_roles (feature_id, role, is_allowed)
SELECT af.id, r.role, true
FROM public.assistant_features af
CROSS JOIN (VALUES ('owner'), ('manager'), ('employee'), ('partner')) AS r(role);

-- =============================================
-- 3. ASSISTANT FEATURE PRICING
-- =============================================
CREATE TABLE public.assistant_feature_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_id UUID NOT NULL REFERENCES public.assistant_features(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL,
  availability TEXT NOT NULL DEFAULT 'included' CHECK (availability IN ('included', 'unavailable', 'paid_addon')),
  monthly_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(feature_id, plan_type)
);

ALTER TABLE public.assistant_feature_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feature pricing"
  ON public.assistant_feature_pricing FOR SELECT USING (true);

CREATE POLICY "Super admin manages feature pricing"
  ON public.assistant_feature_pricing FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_assistant_feature_pricing_updated_at
  BEFORE UPDATE ON public.assistant_feature_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.assistant_feature_pricing (feature_id, plan_type, availability, monthly_price)
SELECT af.id, pt.plan, 'included', 0
FROM public.assistant_features af
CROSS JOIN (VALUES ('free'), ('basic'), ('professional')) AS pt(plan);

-- =============================================
-- 4. PLATFORM ANNOUNCEMENTS
-- =============================================
CREATE TABLE public.platform_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link_url TEXT,
  link_label TEXT,
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'plan', 'role', 'user')),
  target_value TEXT,
  frequency_days INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users read announcements"
  ON public.platform_announcements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Super admin manages announcements"
  ON public.platform_announcements FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_platform_announcements_updated_at
  BEFORE UPDATE ON public.platform_announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 5. ANNOUNCEMENT DISMISSALS
-- =============================================
CREATE TABLE public.announcement_dismissals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  announcement_id UUID NOT NULL REFERENCES public.platform_announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

ALTER TABLE public.announcement_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own dismissals"
  ON public.announcement_dismissals FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
