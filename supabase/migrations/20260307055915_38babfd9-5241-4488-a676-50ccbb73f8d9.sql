
CREATE TABLE public.accounting_asset_maintenances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid REFERENCES public.accounting_assets(id) ON DELETE CASCADE NOT NULL,
  scheduled_date date NOT NULL,
  description text NOT NULL,
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.accounting_asset_maintenances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage maintenances for their business assets"
ON public.accounting_asset_maintenances
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.accounting_assets a
    WHERE a.id = accounting_asset_maintenances.asset_id
    AND (
      a.business_id = public.get_user_business_id(auth.uid())
      OR public.is_super_admin(auth.uid())
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.accounting_assets a
    WHERE a.id = accounting_asset_maintenances.asset_id
    AND (
      a.business_id = public.get_user_business_id(auth.uid())
      OR public.is_super_admin(auth.uid())
    )
  )
);
