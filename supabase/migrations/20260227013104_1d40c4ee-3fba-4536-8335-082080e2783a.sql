
-- Business type configurations managed by Super Admin
CREATE TABLE public.business_type_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'Store',
  country text, -- null = global
  is_active boolean NOT NULL DEFAULT true,
  module_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[],
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_type_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view active business types"
  ON public.business_type_configs FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

CREATE POLICY "Super admin can manage all business types"
  ON public.business_type_configs FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Copy shop configuration per business (mode 1-4)
CREATE TABLE public.copy_shop_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  mode integer NOT NULL DEFAULT 1 CHECK (mode >= 1 AND mode <= 4),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(business_id)
);

ALTER TABLE public.copy_shop_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view own copy shop config"
  ON public.copy_shop_config FOR SELECT
  USING (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "Owner and manager can manage copy shop config"
  ON public.copy_shop_config FOR ALL
  USING (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Super admin can manage all copy shop configs"
  ON public.copy_shop_config FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Print categories for copy shops
CREATE TABLE public.print_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.print_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view print categories"
  ON public.print_categories FOR SELECT
  USING (
    business_id IS NULL OR 
    business_id = get_user_business_id(auth.uid())
  );

CREATE POLICY "Owner and manager can manage print categories"
  ON public.print_categories FOR ALL
  USING (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Super admin can manage all print categories"
  ON public.print_categories FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Add station column to employees for copy shop assignment
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS station text NOT NULL DEFAULT 'both';
-- station values: 'prints', 'services', 'both'

-- Insert default print categories (business_id = NULL means global defaults)
INSERT INTO public.print_categories (business_id, name, is_default, sort_order) VALUES
  (NULL, 'Hojas', true, 1),
  (NULL, 'Fotos Carnet', true, 2),
  (NULL, 'Cartulinas', true, 3),
  (NULL, 'Micas Completas', true, 4),
  (NULL, 'Micas por Tramos', true, 5),
  (NULL, 'Files', true, 6),
  (NULL, 'Carpetas Plásticas', true, 7),
  (NULL, 'Trabajos Digitales', true, 8);

-- Insert initial business type configs
INSERT INTO public.business_type_configs (key, name, description, icon, country, sort_order) VALUES
  ('store', 'Tienda', 'Negocio de venta de productos con inventario y punto de venta', 'Store', NULL, 1),
  ('copy_shop', 'Punto de Copias', 'Centro de impresiones y servicios documentales', 'Printer', 'cuba', 2),
  ('gym', 'Gimnasio', 'Centro deportivo con membresías y control de acceso', 'Dumbbell', NULL, 3);
