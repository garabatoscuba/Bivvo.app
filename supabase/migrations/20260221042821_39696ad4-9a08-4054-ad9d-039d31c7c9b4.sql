
-- Add status column to businesses for activate/deactivate
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
