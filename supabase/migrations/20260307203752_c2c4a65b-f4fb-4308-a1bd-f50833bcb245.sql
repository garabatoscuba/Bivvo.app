
-- Table for shift inventory counts
CREATE TABLE public.inventory_counts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  shift_id UUID REFERENCES public.jornadas(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  system_stock NUMERIC NOT NULL DEFAULT 0,
  counted_stock NUMERIC NOT NULL DEFAULT 0,
  difference NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_inventory_counts_business ON public.inventory_counts(business_id);
CREATE INDEX idx_inventory_counts_shift ON public.inventory_counts(shift_id);

-- RLS
ALTER TABLE public.inventory_counts ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert their own counts
CREATE POLICY "Users can insert own counts"
  ON public.inventory_counts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Owner and super_admin can read all counts for their business
CREATE POLICY "Owner can read business counts"
  ON public.inventory_counts FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'owner')
    AND business_id = public.get_user_business_id(auth.uid())
  );

CREATE POLICY "Super admin can read all counts"
  ON public.inventory_counts FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- Employees can read their own counts
CREATE POLICY "Users can read own counts"
  ON public.inventory_counts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
