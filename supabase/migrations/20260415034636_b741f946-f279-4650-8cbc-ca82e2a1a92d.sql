
-- 1. RLS: Allow sellers to update sales (cancel)
CREATE POLICY "Sellers can cancel own sales"
ON public.sales
FOR UPDATE
TO authenticated
USING (
  public.is_employee_of_business(auth.uid(), (SELECT business_id FROM public.branches WHERE id = branch_id))
  AND user_id = auth.uid()
)
WITH CHECK (
  public.is_employee_of_business(auth.uid(), (SELECT business_id FROM public.branches WHERE id = branch_id))
  AND user_id = auth.uid()
);

-- 2. RLS: Allow sellers to update service_entries (cancel)
CREATE POLICY "Sellers can cancel own service entries"
ON public.service_entries
FOR UPDATE
TO authenticated
USING (
  public.is_employee_of_business(auth.uid(), (SELECT business_id FROM public.branches WHERE id = branch_id))
  AND user_id = auth.uid()
)
WITH CHECK (
  public.is_employee_of_business(auth.uid(), (SELECT business_id FROM public.branches WHERE id = branch_id))
  AND user_id = auth.uid()
);

-- 3. Trigger: restore service ingredients on cancel
CREATE OR REPLACE FUNCTION public.restore_service_ingredients_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _ingredient RECORD;
  _deduct_qty NUMERIC;
  _yield_qty NUMERIC;
  _branch_name TEXT;
  _biz_id UUID;
  _seller_name TEXT;
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
    -- Only restore if the entry had a category with ingredients
    IF OLD.category_id IS NOT NULL THEN
      SELECT COALESCE(yield_quantity, 1) INTO _yield_qty
      FROM public.service_categories WHERE id = OLD.category_id;
      IF _yield_qty IS NULL OR _yield_qty < 1 THEN _yield_qty := 1; END IF;

      FOR _ingredient IN
        SELECT sci.material_id, sci.quantity, sci.unit,
               rm.unit_purchase
        FROM public.service_cost_ingredients sci
        JOIN public.raw_materials rm ON rm.id = sci.material_id
        WHERE sci.category_id = OLD.category_id
          AND sci.ingredient_type = 'base'
      LOOP
        _deduct_qty := public.convert_recipe_units(
          _ingredient.quantity,
          COALESCE(_ingredient.unit, _ingredient.unit_purchase, 'pieza'),
          COALESCE(_ingredient.unit_purchase, 'pieza')
        ) / _yield_qty;

        IF _deduct_qty <= 0 THEN CONTINUE; END IF;

        UPDATE public.raw_materials
        SET stock_vendedor = stock_vendedor + _deduct_qty,
            updated_at = now()
        WHERE id = _ingredient.material_id;

        INSERT INTO public.inventory_movements (branch_id, product_id, user_id, movement_type, quantity, notes)
        VALUES (NEW.branch_id, _ingredient.material_id, NEW.user_id, 'return', _deduct_qty,
                'Devolución por cancelación de servicio');
      END LOOP;
    END IF;

    -- Create notification
    SELECT b.business_id, b.name INTO _biz_id, _branch_name
    FROM public.branches b WHERE b.id = NEW.branch_id;

    SELECT p.full_name INTO _seller_name
    FROM public.profiles p WHERE p.user_id = NEW.user_id LIMIT 1;

    INSERT INTO public.notifications (business_id, branch_id, type, title, message, metadata)
    VALUES (
      _biz_id,
      NEW.branch_id,
      'service_cancelled',
      'Servicio cancelado',
      COALESCE(_seller_name, 'Usuario') || ' canceló un servicio ($' || NEW.total || ') en ' || COALESCE(_branch_name, 'sucursal'),
      jsonb_build_object('service_entry_id', NEW.id, 'total', NEW.total, 'cancelled_by', NEW.user_id)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER restore_service_ingredients_on_cancel
BEFORE UPDATE ON public.service_entries
FOR EACH ROW
EXECUTE FUNCTION public.restore_service_ingredients_on_cancel();
