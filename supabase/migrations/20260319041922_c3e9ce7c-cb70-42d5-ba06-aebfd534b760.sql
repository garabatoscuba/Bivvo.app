ALTER TABLE public.product_stock_entries ADD COLUMN IF NOT EXISTS purchase_unit text;
ALTER TABLE public.raw_material_entries ADD COLUMN IF NOT EXISTS purchase_unit text;