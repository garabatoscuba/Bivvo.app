
-- Table to track stock entry details for cost analysis in Treasury
CREATE TABLE public.product_stock_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_cost NUMERIC NULL,
  sale_price NUMERIC NULL,
  supplier TEXT NULL,
  notes TEXT NULL,
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_stock_entries ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can insert for their business
CREATE POLICY "Users can insert stock entries for their business"
ON public.product_stock_entries
FOR INSERT
TO authenticated
WITH CHECK (
  business_id = public.get_user_business_id(auth.uid())
);

-- Policy: authenticated users can read their business entries
CREATE POLICY "Users can read stock entries for their business"
ON public.product_stock_entries
FOR SELECT
TO authenticated
USING (
  business_id = public.get_user_business_id(auth.uid())
);

-- Index for treasury queries
CREATE INDEX idx_product_stock_entries_business ON public.product_stock_entries(business_id, created_at DESC);
CREATE INDEX idx_product_stock_entries_product ON public.product_stock_entries(product_id);
