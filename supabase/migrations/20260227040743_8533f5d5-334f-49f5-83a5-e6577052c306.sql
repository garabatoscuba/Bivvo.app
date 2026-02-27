
ALTER TYPE payment_type ADD VALUE IF NOT EXISTS 'mixed';

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cash_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS transfer_amount numeric NOT NULL DEFAULT 0;
