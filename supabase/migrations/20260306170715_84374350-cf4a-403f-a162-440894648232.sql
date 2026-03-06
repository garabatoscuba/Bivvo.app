
-- Add 'partner' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'partner';

-- Partners table
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  discount_type text NOT NULL DEFAULT 'percentage',
  discount_value numeric NOT NULL DEFAULT 0,
  applies_to_plans text[] NOT NULL DEFAULT '{"basic"}',
  user_limit integer,
  expires_at timestamptz,
  commission_percent numeric NOT NULL DEFAULT 0,
  commission_duration_months integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- Partner can read own record; super_admin can CRUD all
CREATE POLICY "partners_select_own" ON public.partners FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin(auth.uid()));

CREATE POLICY "partners_insert_admin" ON public.partners FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "partners_update_admin" ON public.partners FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "partners_delete_admin" ON public.partners FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Allow anyone authenticated to look up a partner by code (for applying discount)
CREATE POLICY "partners_select_by_code" ON public.partners FOR SELECT TO authenticated
  USING (is_active = true);

-- Partner referrals table
CREATE TABLE public.partner_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type text,
  used_at timestamptz NOT NULL DEFAULT now(),
  commission_earned numeric NOT NULL DEFAULT 0,
  commission_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_select" ON public.partner_referrals FOR SELECT TO authenticated
  USING (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "referrals_insert_admin" ON public.partner_referrals FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "referrals_update_admin" ON public.partner_referrals FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Partner payouts table
CREATE TABLE public.partner_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  amount numeric NOT NULL DEFAULT 0,
  note text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_payouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payouts_select" ON public.partner_payouts FOR SELECT TO authenticated
  USING (
    partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid())
    OR public.is_super_admin(auth.uid())
  );

CREATE POLICY "payouts_insert_admin" ON public.partner_payouts FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Add partner_id to plan_requests for tracking conversions
ALTER TABLE public.plan_requests ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.partners(id);

-- Add referral_code to profiles for tracking which code was used at signup
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code text;
