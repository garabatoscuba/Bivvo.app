
-- Add Clientes module to store business type config
UPDATE public.business_type_configs
SET module_ids = array_append(module_ids, 'b46bc72d-985c-46c1-8c46-66f5fc83dae7'),
    updated_at = now()
WHERE key = 'store'
  AND NOT ('b46bc72d-985c-46c1-8c46-66f5fc83dae7' = ANY(module_ids));
