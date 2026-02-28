-- Desactivar modalidades eliminadas por redundancia con Salario Base
UPDATE public.salary_modalities
SET is_active = false, updated_at = now()
WHERE modality_type IN ('fixed', 'fixed_ladder', 'fixed_plus_sales_percent')
  AND is_active = true;