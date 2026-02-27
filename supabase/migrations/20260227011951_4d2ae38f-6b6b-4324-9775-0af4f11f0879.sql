
-- Fix: Change restrictive SELECT policies to permissive so super admin can see inactive items

-- platform_modules: drop restrictive SELECT, recreate as permissive
DROP POLICY IF EXISTS "Authenticated users can view active modules" ON public.platform_modules;
CREATE POLICY "Authenticated users can view active modules"
  ON public.platform_modules FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- platform_plugins: drop restrictive SELECT, recreate as permissive
DROP POLICY IF EXISTS "Authenticated users can view active plugins" ON public.platform_plugins;
CREATE POLICY "Authenticated users can view active plugins"
  ON public.platform_plugins FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = true);

-- Also make super admin ALL policies permissive (they already are by default since CREATE POLICY defaults to PERMISSIVE)
DROP POLICY IF EXISTS "Super admin can manage all modules" ON public.platform_modules;
CREATE POLICY "Super admin can manage all modules"
  ON public.platform_modules FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admin can manage all plugins" ON public.platform_plugins;
CREATE POLICY "Super admin can manage all plugins"
  ON public.platform_plugins FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Same fix for pricing and offers tables
DROP POLICY IF EXISTS "Authenticated users can view pricing" ON public.module_plugin_pricing;
CREATE POLICY "Authenticated users can view pricing"
  ON public.module_plugin_pricing FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Super admin can manage all pricing" ON public.module_plugin_pricing;
CREATE POLICY "Super admin can manage all pricing"
  ON public.module_plugin_pricing FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));
