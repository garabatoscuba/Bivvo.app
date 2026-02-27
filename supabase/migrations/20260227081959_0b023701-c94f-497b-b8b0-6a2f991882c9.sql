
-- Add next-day fund config columns
ALTER TABLE public.cash_register_config
  ADD COLUMN IF NOT EXISTS next_day_fund_mode text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS next_day_fund_amount numeric NOT NULL DEFAULT 0;

-- Add next-day fund to cash registers
ALTER TABLE public.cash_registers
  ADD COLUMN IF NOT EXISTS next_day_fund numeric NOT NULL DEFAULT 0;
