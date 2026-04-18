UPDATE public.business_type_configs SET is_active = true WHERE key IN ('estaurente/safetería','store','copy_shop','gym');
UPDATE public.business_type_configs SET name = 'Tienda' WHERE key = 'store';
UPDATE public.business_type_configs SET name = 'Restaurante / Cafetería' WHERE key = 'estaurente/safetería';
UPDATE public.business_type_configs SET name = 'Punto de Copias' WHERE key = 'copy_shop';
UPDATE public.business_type_configs SET name = 'Gimnasio' WHERE key = 'gym';