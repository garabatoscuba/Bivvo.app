
-- Treasury categories table
CREATE TABLE public.treasury_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.treasury_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage treasury categories"
  ON public.treasury_categories FOR ALL
  USING (
    business_id = get_user_business_id(auth.uid())
    AND has_role(auth.uid(), 'owner'::app_role)
  )
  WITH CHECK (
    business_id = get_user_business_id(auth.uid())
    AND has_role(auth.uid(), 'owner'::app_role)
  );

CREATE POLICY "Super admin can manage all treasury categories"
  ON public.treasury_categories FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- Treasury movements table
CREATE TABLE public.treasury_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('extraccion', 'inyeccion')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL DEFAULT 'efectivo' CHECK (payment_method IN ('efectivo', 'transferencia', 'mixto')),
  cash_amount NUMERIC NOT NULL DEFAULT 0,
  transfer_amount NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  origin TEXT,
  category_id UUID REFERENCES public.treasury_categories(id) ON DELETE SET NULL,
  label TEXT NOT NULL DEFAULT 'negocio' CHECK (label IN ('personal', 'negocio')),
  registered_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.treasury_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage treasury movements"
  ON public.treasury_movements FOR ALL
  USING (
    business_id = get_user_business_id(auth.uid())
    AND has_role(auth.uid(), 'owner'::app_role)
  )
  WITH CHECK (
    business_id = get_user_business_id(auth.uid())
    AND has_role(auth.uid(), 'owner'::app_role)
  );

CREATE POLICY "Super admin can manage all treasury movements"
  ON public.treasury_movements FOR ALL
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));
