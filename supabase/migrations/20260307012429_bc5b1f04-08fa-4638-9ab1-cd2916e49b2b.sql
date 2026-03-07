-- Add unique constraint for upsert
ALTER TABLE public.partner_referrals ADD CONSTRAINT partner_referrals_partner_referred_unique UNIQUE (partner_id, referred_user_id);

-- Allow users to insert their own referral (referred_user_id = auth.uid())
DROP POLICY IF EXISTS referrals_insert_admin ON public.partner_referrals;
CREATE POLICY "referrals_insert" ON public.partner_referrals FOR INSERT TO authenticated
  WITH CHECK (referred_user_id = auth.uid() OR is_super_admin(auth.uid()));