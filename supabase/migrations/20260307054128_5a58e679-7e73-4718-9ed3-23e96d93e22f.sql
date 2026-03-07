-- Fix super_admin policy to allow all operations including INSERT/UPDATE
DROP POLICY IF EXISTS "Super admin full access accounting_expenses" ON public.accounting_expenses;
CREATE POLICY "Super admin full access accounting_expenses"
  ON public.accounting_expenses FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admin full access accounting_assets" ON public.accounting_assets;
CREATE POLICY "Super admin full access accounting_assets"
  ON public.accounting_assets FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Super admin full access accounting_asset_interventions" ON public.accounting_asset_interventions;
CREATE POLICY "Super admin full access accounting_asset_interventions"
  ON public.accounting_asset_interventions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));