
-- Store settings per branch (portal config)
CREATE TABLE public.store_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id UUID NOT NULL UNIQUE REFERENCES public.branches(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  has_delivery BOOLEAN NOT NULL DEFAULT false,
  schedule JSONB NOT NULL DEFAULT '{
    "monday": {"open": "08:00", "close": "18:00", "enabled": true},
    "tuesday": {"open": "08:00", "close": "18:00", "enabled": true},
    "wednesday": {"open": "08:00", "close": "18:00", "enabled": true},
    "thursday": {"open": "08:00", "close": "18:00", "enabled": true},
    "friday": {"open": "08:00", "close": "18:00", "enabled": true},
    "saturday": {"open": "09:00", "close": "14:00", "enabled": true},
    "sunday": {"open": null, "close": null, "enabled": false}
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Business members can view store settings"
ON public.store_settings FOR SELECT
USING (get_branch_business_id(branch_id) = get_user_business_id(auth.uid()));

CREATE POLICY "Owner and manager can manage store settings"
ON public.store_settings FOR ALL
USING (
  get_branch_business_id(branch_id) = get_user_business_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
  get_branch_business_id(branch_id) = get_user_business_id(auth.uid())
  AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Super admin can manage all store settings"
ON public.store_settings FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Auto-update timestamp
CREATE TRIGGER update_store_settings_updated_at
BEFORE UPDATE ON public.store_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
