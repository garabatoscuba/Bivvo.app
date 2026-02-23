
ALTER TABLE public.service_categories 
  ADD COLUMN IF NOT EXISTS icon text DEFAULT 'DollarSign',
  ADD COLUMN IF NOT EXISTS fixed_price numeric DEFAULT NULL;
