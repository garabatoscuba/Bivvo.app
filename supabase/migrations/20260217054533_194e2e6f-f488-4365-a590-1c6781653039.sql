
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id UUID, -- target user (null = all business members)
  type TEXT NOT NULL, -- 'low_stock', 'sale', 'inventory_movement'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_notifications_business ON public.notifications(business_id, created_at DESC);
CREATE INDEX idx_notifications_read ON public.notifications(business_id, is_read, created_at DESC);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Business members can view notifications"
ON public.notifications FOR SELECT
USING (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "Business members can update own notifications"
ON public.notifications FOR UPDATE
USING (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "Super admin can manage all notifications"
ON public.notifications FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- Trigger: notify on low stock after stock update
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  prod RECORD;
  branch_name TEXT;
  biz_id UUID;
BEGIN
  -- Check if quantity dropped below min_stock
  SELECT p.name, p.code, p.min_stock, p.business_id
  INTO prod
  FROM public.products p
  WHERE p.id = NEW.product_id;

  IF prod IS NOT NULL AND NEW.quantity <= prod.min_stock AND NEW.quantity >= 0 THEN
    SELECT b.name INTO branch_name FROM public.branches b WHERE b.id = NEW.branch_id;
    biz_id := prod.business_id;

    -- Avoid duplicate notifications for same product/branch in last hour
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE business_id = biz_id
        AND type = 'low_stock'
        AND metadata->>'product_id' = NEW.product_id::text
        AND metadata->>'branch_id' = NEW.branch_id::text
        AND created_at > now() - interval '1 hour'
    ) THEN
      INSERT INTO public.notifications (business_id, branch_id, type, title, message, metadata)
      VALUES (
        biz_id,
        NEW.branch_id,
        'low_stock',
        'Stock bajo: ' || prod.name,
        prod.name || ' (' || prod.code || ') tiene ' || NEW.quantity || ' unidades en ' || COALESCE(branch_name, 'sucursal') || '. Mínimo: ' || prod.min_stock,
        jsonb_build_object('product_id', NEW.product_id, 'branch_id', NEW.branch_id, 'quantity', NEW.quantity, 'min_stock', prod.min_stock)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_low_stock
AFTER UPDATE OF quantity ON public.branch_stock
FOR EACH ROW
EXECUTE FUNCTION public.notify_low_stock();

-- Trigger: notify on new sale
CREATE OR REPLACE FUNCTION public.notify_new_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  biz_id UUID;
  branch_name TEXT;
  seller_name TEXT;
BEGIN
  biz_id := get_branch_business_id(NEW.branch_id);
  SELECT b.name INTO branch_name FROM public.branches b WHERE b.id = NEW.branch_id;
  SELECT p.full_name INTO seller_name FROM public.profiles p WHERE p.user_id = NEW.user_id;

  INSERT INTO public.notifications (business_id, branch_id, type, title, message, metadata)
  VALUES (
    biz_id,
    NEW.branch_id,
    'sale',
    'Nueva venta: ' || NEW.sale_number,
    COALESCE(seller_name, 'Usuario') || ' registró una venta de Bs ' || NEW.total || ' en ' || COALESCE(branch_name, 'sucursal'),
    jsonb_build_object('sale_id', NEW.id, 'sale_number', NEW.sale_number, 'total', NEW.total, 'user_id', NEW.user_id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_new_sale
AFTER INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_sale();

-- Trigger: notify on inventory movements (not from sales, those have their own)
CREATE OR REPLACE FUNCTION public.notify_inventory_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  biz_id UUID;
  prod_name TEXT;
  prod_code TEXT;
  branch_name TEXT;
  user_name TEXT;
  type_label TEXT;
BEGIN
  -- Skip sale movements (already covered by sale notification)
  IF NEW.movement_type = 'sale' THEN
    RETURN NEW;
  END IF;

  biz_id := get_branch_business_id(NEW.branch_id);
  SELECT p.name, p.code INTO prod_name, prod_code FROM public.products p WHERE p.id = NEW.product_id;
  SELECT b.name INTO branch_name FROM public.branches b WHERE b.id = NEW.branch_id;
  SELECT p.full_name INTO user_name FROM public.profiles p WHERE p.user_id = NEW.user_id;

  type_label := CASE NEW.movement_type
    WHEN 'purchase' THEN 'Compra'
    WHEN 'transfer_in' THEN 'Transferencia entrada'
    WHEN 'transfer_out' THEN 'Transferencia salida'
    WHEN 'loss' THEN 'Pérdida'
    WHEN 'adjustment' THEN 'Ajuste'
    WHEN 'return' THEN 'Devolución'
    ELSE NEW.movement_type::text
  END;

  INSERT INTO public.notifications (business_id, branch_id, type, title, message, metadata)
  VALUES (
    biz_id,
    NEW.branch_id,
    'inventory_movement',
    type_label || ': ' || prod_name,
    COALESCE(user_name, 'Usuario') || ' registró ' || type_label || ' de ' || NEW.quantity || ' unidades de ' || prod_name || ' (' || prod_code || ') en ' || COALESCE(branch_name, 'sucursal'),
    jsonb_build_object('product_id', NEW.product_id, 'movement_type', NEW.movement_type, 'quantity', NEW.quantity, 'user_id', NEW.user_id)
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_inventory_movement
AFTER INSERT ON public.inventory_movements
FOR EACH ROW
EXECUTE FUNCTION public.notify_inventory_movement();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
