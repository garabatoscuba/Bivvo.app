ALTER TABLE public.products 
  ADD COLUMN IF NOT EXISTS cost_method text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS indirect_cost_percentage numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS indirect_cost_amount numeric DEFAULT 0;