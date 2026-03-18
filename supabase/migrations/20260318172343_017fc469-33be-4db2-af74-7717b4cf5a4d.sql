-- Fix stale English module_keys in assistant_quick_questions to match Spanish keys
UPDATE public.assistant_quick_questions SET module_key = 'empleados' WHERE module_key = 'employees';
UPDATE public.assistant_quick_questions SET module_key = 'inventario' WHERE module_key = 'inventory';
UPDATE public.assistant_quick_questions SET module_key = 'ventas' WHERE module_key = 'sales';
UPDATE public.assistant_quick_questions SET module_key = 'servicios' WHERE module_key = 'services';
UPDATE public.assistant_quick_questions SET module_key = 'configuracion' WHERE module_key = 'settings';
UPDATE public.assistant_quick_questions SET module_key = 'nomina' WHERE module_key = 'nómina';
DELETE FROM public.assistant_module_instructions WHERE module_key = 'nómina' AND EXISTS (SELECT 1 FROM public.assistant_module_instructions WHERE module_key = 'nomina');
UPDATE public.assistant_module_instructions SET module_key = 'nomina' WHERE module_key = 'nómina';