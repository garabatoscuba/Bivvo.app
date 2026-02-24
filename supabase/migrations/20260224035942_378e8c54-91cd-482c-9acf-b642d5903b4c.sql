
-- Tip configuration per business (owner percent + position-based distribution)
CREATE TABLE public.tip_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  owner_percent NUMERIC NOT NULL DEFAULT 0,
  total_positions INTEGER NOT NULL DEFAULT 3,
  conditions JSONB NOT NULL DEFAULT '[{"positions": 3, "tip_percent": 33}, {"positions": 2, "tip_percent": 50}, {"positions": 1, "tip_percent": 100}]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(business_id)
);

-- Individual tip entries (manual or automatic)
CREATE TABLE public.tip_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  tip_type TEXT NOT NULL DEFAULT 'manual',
  jornada_id UUID REFERENCES public.jornadas(id),
  notes TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for tip_config
ALTER TABLE public.tip_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner and manager can manage tip config"
  ON public.tip_config FOR ALL
  USING (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Employees can view employer tip config"
  ON public.tip_config FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM employees e JOIN profiles p ON p.email = e.email
    WHERE p.user_id = auth.uid() AND e.business_id = tip_config.business_id
  ));

CREATE POLICY "Super admin can manage all tip config"
  ON public.tip_config FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- RLS for tip_entries
ALTER TABLE public.tip_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own tip entries"
  ON public.tip_entries FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own tip entries"
  ON public.tip_entries FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Owner and manager can manage tip entries"
  ON public.tip_entries FOR ALL
  USING (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)))
  WITH CHECK (business_id = get_user_business_id(auth.uid()) AND (has_role(auth.uid(), 'owner'::app_role) OR has_role(auth.uid(), 'manager'::app_role)));

CREATE POLICY "Employees can view employer tip entries"
  ON public.tip_entries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM employees e JOIN profiles p ON p.email = e.email
    WHERE p.user_id = auth.uid() AND e.business_id = tip_entries.business_id
  ));

CREATE POLICY "Super admin can manage all tip entries"
  ON public.tip_entries FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Trigger for updated_at on tip_config
CREATE TRIGGER update_tip_config_updated_at
  BEFORE UPDATE ON public.tip_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
