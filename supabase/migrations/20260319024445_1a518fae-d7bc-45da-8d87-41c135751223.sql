
-- Add is_internal flag to insumo_areas
ALTER TABLE public.insumo_areas ADD COLUMN is_internal boolean NOT NULL DEFAULT false;

-- Update all existing "Uso Interno" areas to be internal with correct icon and color
UPDATE public.insumo_areas 
SET is_internal = true, icon = 'Home', color = 'primary', name = 'Uso Interno'
WHERE name = 'Uso Interno';

-- Ensure every business has an internal area (for existing businesses that don't have one)
INSERT INTO public.insumo_areas (business_id, name, icon, color, is_internal)
SELECT b.id, 'Uso Interno', 'Home', 'primary', true
FROM public.businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM public.insumo_areas ia 
  WHERE ia.business_id = b.id AND ia.is_internal = true
);
