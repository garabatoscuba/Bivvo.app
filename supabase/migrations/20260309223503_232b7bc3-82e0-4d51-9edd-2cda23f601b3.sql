
CREATE OR REPLACE FUNCTION public.update_stock_on_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    sale_branch_id UUID;
    _product_tipo TEXT;
BEGIN
    SELECT branch_id INTO sale_branch_id
    FROM public.sales
    WHERE id = NEW.sale_id;

    -- Check if product is elaborado (stock managed by recalculate_elaborado_stock)
    SELECT tipo INTO _product_tipo FROM public.products WHERE id = NEW.product_id;

    IF _product_tipo = 'elaborado' THEN
        -- Only log inventory movement; stock is handled by recipe ingredient deduction + recalculation
        INSERT INTO public.inventory_movements (branch_id, product_id, user_id, movement_type, quantity, reference_id)
        SELECT sale_branch_id, NEW.product_id, s.user_id, 'sale', NEW.quantity, NEW.sale_id
        FROM public.sales s WHERE s.id = NEW.sale_id;

        RETURN NEW;
    END IF;

    -- Regular/ingredient products: deduct stock directly
    UPDATE public.branch_stock
    SET quantity = quantity - NEW.quantity,
        updated_at = now()
    WHERE branch_id = sale_branch_id
    AND product_id = NEW.product_id;

    IF NOT FOUND THEN
        INSERT INTO public.branch_stock (branch_id, product_id, quantity)
        VALUES (sale_branch_id, NEW.product_id, -NEW.quantity);
    END IF;

    -- Log inventory movement
    INSERT INTO public.inventory_movements (branch_id, product_id, user_id, movement_type, quantity, reference_id)
    SELECT sale_branch_id, NEW.product_id, s.user_id, 'sale', NEW.quantity, NEW.sale_id
    FROM public.sales s WHERE s.id = NEW.sale_id;

    RETURN NEW;
END;
$function$;
