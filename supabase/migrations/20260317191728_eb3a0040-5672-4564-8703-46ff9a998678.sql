
-- Add insumo_area_id column to products table to organize ingredients by area
ALTER TABLE public.products ADD COLUMN insumo_area_id uuid REFERENCES public.insumo_areas(id) ON DELETE SET NULL;

-- Index for filtering ingredients by area
CREATE INDEX idx_products_insumo_area_id ON public.products(insumo_area_id) WHERE insumo_area_id IS NOT NULL;
