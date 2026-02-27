
-- Platform modules table
CREATE TABLE public.platform_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'Package',
  description text,
  sidebar_label text NOT NULL,
  business_types text[] NOT NULL DEFAULT ARRAY['store'],
  countries text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage all modules"
  ON public.platform_modules FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Authenticated users can view active modules"
  ON public.platform_modules FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- Platform plugins table
CREATE TABLE public.platform_plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  module_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  countries text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_plugins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage all plugins"
  ON public.platform_plugins FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Authenticated users can view active plugins"
  ON public.platform_plugins FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- Pricing configuration table (for both modules and plugins)
CREATE TABLE public.module_plugin_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('module', 'plugin')),
  entity_id uuid NOT NULL,
  plan_type text NOT NULL,
  availability text NOT NULL DEFAULT 'included' CHECK (availability IN ('included', 'paid_addon', 'unavailable')),
  monthly_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, plan_type)
);

ALTER TABLE public.module_plugin_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage all pricing"
  ON public.module_plugin_pricing FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Authenticated users can view pricing"
  ON public.module_plugin_pricing FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Pricing offers/presets table
CREATE TABLE public.pricing_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  discount_percent numeric NOT NULL DEFAULT 0,
  expires_at timestamptz,
  entity_type text NOT NULL CHECK (entity_type IN ('module', 'plugin')),
  entity_id uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage all offers"
  ON public.pricing_offers FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Authenticated users can view active offers"
  ON public.pricing_offers FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);
