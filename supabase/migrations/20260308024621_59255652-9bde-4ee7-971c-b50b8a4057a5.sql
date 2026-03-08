ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS phone_number text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS product_name text;
ALTER TABLE public.reviews ALTER COLUMN affiliate_id DROP NOT NULL;
ALTER TABLE public.reviews ALTER COLUMN rating DROP NOT NULL;