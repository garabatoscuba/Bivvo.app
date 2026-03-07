
-- Allow users to update their own referral entry (needed for upsert)
DROP POLICY IF EXISTS referrals_update_admin ON public.partner_referrals;
CREATE POLICY "referrals_update" ON public.partner_referrals FOR UPDATE TO authenticated
  USING (referred_user_id = auth.uid() OR is_super_admin(auth.uid()))
  WITH CHECK (referred_user_id = auth.uid() OR is_super_admin(auth.uid()));
