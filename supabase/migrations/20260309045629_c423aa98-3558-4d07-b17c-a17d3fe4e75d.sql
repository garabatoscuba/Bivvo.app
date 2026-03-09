
ALTER TABLE public.kitchen_orders 
ADD COLUMN IF NOT EXISTS notes text DEFAULT '',
ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS sale_number text DEFAULT '';
