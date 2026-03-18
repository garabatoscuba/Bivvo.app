ALTER TABLE public.raw_materials
ADD COLUMN IF NOT EXISTS category_id uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'raw_materials_category_id_fkey'
  ) THEN
    ALTER TABLE public.raw_materials
    ADD CONSTRAINT raw_materials_category_id_fkey
    FOREIGN KEY (category_id)
    REFERENCES public.categories(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_raw_materials_category_id
ON public.raw_materials(category_id);