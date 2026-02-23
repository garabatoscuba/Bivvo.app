
ALTER TABLE public.salary_modalities ADD COLUMN IF NOT EXISTS applies_to text NOT NULL DEFAULT 'both' CHECK (applies_to IN ('services', 'products', 'both'));
ALTER TABLE public.salary_modalities ADD COLUMN IF NOT EXISTS presets jsonb NOT NULL DEFAULT '[]'::jsonb;
