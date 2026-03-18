
-- Drop the FK constraint so ingredient_id can reference raw_materials too
ALTER TABLE public.recipe_ingredients DROP CONSTRAINT IF EXISTS recipe_ingredients_ingredient_id_fkey;

-- Add a column to flag whether the ingredient is a raw_material
ALTER TABLE public.recipe_ingredients ADD COLUMN IF NOT EXISTS is_raw_material boolean NOT NULL DEFAULT false;
