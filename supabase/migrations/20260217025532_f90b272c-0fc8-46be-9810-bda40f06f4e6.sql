
-- Agregar nuevas columnas a products
ALTER TABLE public.products
ADD COLUMN barcode text,
ADD COLUMN supplier text,
ADD COLUMN unit_of_measure text NOT NULL DEFAULT 'pieza',
ADD COLUMN brand text;

-- Actualizar función generate_product_code para formato 0001A
CREATE OR REPLACE FUNCTION public.generate_product_code(_business_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    next_number INTEGER;
    new_code TEXT;
BEGIN
    -- Contar productos existentes del negocio para obtener el siguiente número
    SELECT COUNT(*) + 1
    INTO next_number
    FROM public.products
    WHERE business_id = _business_id;
    
    new_code := LPAD(next_number::TEXT, 4, '0') || 'A';
    RETURN new_code;
END;
$function$;
