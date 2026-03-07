
-- Create audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  user_role text NOT NULL DEFAULT '',
  action_type text NOT NULL,
  action_description text NOT NULL DEFAULT '',
  entity_id text,
  entity_type text,
  ip_address text,
  device_info text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_audit_logs_business_created ON public.audit_logs(business_id, created_at DESC);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(action_type);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only owner and super_admin can read
CREATE POLICY "Owners can read audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner') AND business_id IN (
      SELECT business_id FROM public.profiles WHERE user_id = auth.uid()
    )
    OR public.is_super_admin(auth.uid())
  );

-- No insert/update/delete policies for client — inserts go through security definer function

-- Security definer function to generate code and insert
CREATE OR REPLACE FUNCTION public.insert_audit_log(
  _business_id uuid,
  _branch_id uuid,
  _user_id uuid,
  _user_name text,
  _user_role text,
  _action_type text,
  _action_description text,
  _entity_id text DEFAULT NULL,
  _entity_type text DEFAULT NULL,
  _device_info text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code text;
  _date_str text;
  _seq int;
BEGIN
  _date_str := to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD');
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(code FROM 14) AS integer)
  ), 0) + 1
  INTO _seq
  FROM public.audit_logs
  WHERE business_id = _business_id
    AND code LIKE 'BIV-' || _date_str || '-%';

  _code := 'BIV-' || _date_str || '-' || LPAD(_seq::text, 4, '0');

  INSERT INTO public.audit_logs (
    code, business_id, branch_id, user_id, user_name, user_role,
    action_type, action_description, entity_id, entity_type, device_info
  ) VALUES (
    _code, _business_id, _branch_id, _user_id, _user_name, _user_role,
    _action_type, _action_description, _entity_id, _entity_type, _device_info
  );
END;
$$;
