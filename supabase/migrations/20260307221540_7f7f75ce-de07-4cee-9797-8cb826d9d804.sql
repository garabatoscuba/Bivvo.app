
-- Add archived columns to sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Add archived columns to cash_register_movements
ALTER TABLE public.cash_register_movements ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.cash_register_movements ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Add archived columns to treasury_movements
ALTER TABLE public.treasury_movements ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.treasury_movements ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Add archived columns to jornadas
ALTER TABLE public.jornadas ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.jornadas ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Add archived columns to daily_reports
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.daily_reports ADD COLUMN IF NOT EXISTS archived_at timestamptz;
