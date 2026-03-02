-- Add is_catalog flag and service_name for live services
ALTER TABLE public.service_entries
  ADD COLUMN is_catalog boolean NOT NULL DEFAULT true,
  ADD COLUMN service_name text;

-- Make category_id nullable for live services (no catalog category)
ALTER TABLE public.service_entries
  ALTER COLUMN category_id DROP NOT NULL;