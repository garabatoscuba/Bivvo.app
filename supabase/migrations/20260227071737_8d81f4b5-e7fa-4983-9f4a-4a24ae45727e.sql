
-- Remove duplicate Caja module (the one with wrong sort_order/icon)
DELETE FROM platform_modules WHERE id = '589dfcbf-c7b4-4ea4-adf5-31b34eef8a22';

-- Fix sort_order for the correct Caja module
UPDATE platform_modules SET sort_order = 11 WHERE id = 'dc7f9919-f530-4eed-8666-13a0e8546784';

-- Update business_type_configs to reference the correct Caja module id
UPDATE business_type_configs 
SET module_ids = array_replace(module_ids, '589dfcbf-c7b4-4ea4-adf5-31b34eef8a22'::uuid, 'dc7f9919-f530-4eed-8666-13a0e8546784'::uuid)
WHERE '589dfcbf-c7b4-4ea4-adf5-31b34eef8a22'::uuid = ANY(module_ids);
