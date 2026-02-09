-- Crear enum para estados de producto
CREATE TYPE public.product_status AS ENUM ('for_sale', 'warehouse', 'discontinued');

-- Crear enum para tipos de movimiento de inventario
CREATE TYPE public.inventory_movement_type AS ENUM ('purchase', 'sale', 'transfer_in', 'transfer_out', 'loss', 'adjustment', 'return');

-- Crear enum para tipos de pago
CREATE TYPE public.payment_type AS ENUM ('cash', 'credit', 'card', 'transfer');

-- Crear enum para estado de venta
CREATE TYPE public.sale_status AS ENUM ('completed', 'pending', 'cancelled');

-- ===== TABLA: Categorías de productos =====
CREATE TABLE public.categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'blue', -- pink, green, blue, orange, purple
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ===== TABLA: Productos =====
CREATE TABLE public.products (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    cost_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    sale_price DECIMAL(12, 2) NOT NULL DEFAULT 0,
    image_url TEXT,
    status product_status NOT NULL DEFAULT 'for_sale',
    min_stock INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(business_id, code)
);

-- ===== TABLA: Stock por sucursal =====
CREATE TABLE public.branch_stock (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(branch_id, product_id)
);

-- ===== TABLA: Movimientos de inventario =====
CREATE TABLE public.inventory_movements (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    movement_type inventory_movement_type NOT NULL,
    quantity INTEGER NOT NULL,
    notes TEXT,
    reference_id UUID, -- para vincular a ventas, transferencias, etc.
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ===== TABLA: Clientes =====
CREATE TABLE public.customers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ===== TABLA: Ventas =====
CREATE TABLE public.sales (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    sale_number TEXT NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    discount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total DECIMAL(12, 2) NOT NULL DEFAULT 0,
    payment_type payment_type NOT NULL DEFAULT 'cash',
    status sale_status NOT NULL DEFAULT 'completed',
    amount_paid DECIMAL(12, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ===== TABLA: Items de venta =====
CREATE TABLE public.sale_items (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL,
    cost_price DECIMAL(12, 2) NOT NULL,
    discount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ===== Habilitar RLS en todas las tablas =====
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- ===== Función helper para obtener business_id de una sucursal =====
CREATE OR REPLACE FUNCTION public.get_branch_business_id(_branch_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT business_id FROM public.branches WHERE id = _branch_id LIMIT 1
$$;

-- ===== RLS: Categorías =====
CREATE POLICY "Business members can view categories"
ON public.categories FOR SELECT
USING (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "Owner and manager can manage categories"
ON public.categories FOR ALL
USING (
    business_id = get_user_business_id(auth.uid()) 
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
    business_id = get_user_business_id(auth.uid()) 
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Super admin can manage all categories"
ON public.categories FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- ===== RLS: Productos =====
CREATE POLICY "Business members can view products"
ON public.products FOR SELECT
USING (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "Owner and manager can manage products"
ON public.products FOR ALL
USING (
    business_id = get_user_business_id(auth.uid()) 
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
    business_id = get_user_business_id(auth.uid()) 
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Super admin can manage all products"
ON public.products FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- ===== RLS: Stock por sucursal =====
CREATE POLICY "Business members can view stock"
ON public.branch_stock FOR SELECT
USING (get_branch_business_id(branch_id) = get_user_business_id(auth.uid()));

CREATE POLICY "Owner and manager can manage stock"
ON public.branch_stock FOR ALL
USING (
    get_branch_business_id(branch_id) = get_user_business_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
)
WITH CHECK (
    get_branch_business_id(branch_id) = get_user_business_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Super admin can manage all stock"
ON public.branch_stock FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- ===== RLS: Movimientos de inventario =====
CREATE POLICY "Business members can view movements"
ON public.inventory_movements FOR SELECT
USING (get_branch_business_id(branch_id) = get_user_business_id(auth.uid()));

CREATE POLICY "Business members can create movements"
ON public.inventory_movements FOR INSERT
WITH CHECK (
    get_branch_business_id(branch_id) = get_user_business_id(auth.uid())
    AND user_id = auth.uid()
);

CREATE POLICY "Super admin can manage all movements"
ON public.inventory_movements FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- ===== RLS: Clientes =====
CREATE POLICY "Business members can view customers"
ON public.customers FOR SELECT
USING (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "Business members can manage customers"
ON public.customers FOR ALL
USING (business_id = get_user_business_id(auth.uid()))
WITH CHECK (business_id = get_user_business_id(auth.uid()));

CREATE POLICY "Super admin can manage all customers"
ON public.customers FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- ===== RLS: Ventas =====
CREATE POLICY "Business members can view sales"
ON public.sales FOR SELECT
USING (get_branch_business_id(branch_id) = get_user_business_id(auth.uid()));

CREATE POLICY "Sellers can create sales"
ON public.sales FOR INSERT
WITH CHECK (
    get_branch_business_id(branch_id) = get_user_business_id(auth.uid())
    AND user_id = auth.uid()
);

CREATE POLICY "Owner and manager can update sales"
ON public.sales FOR UPDATE
USING (
    get_branch_business_id(branch_id) = get_user_business_id(auth.uid())
    AND (has_role(auth.uid(), 'owner') OR has_role(auth.uid(), 'manager'))
);

CREATE POLICY "Super admin can manage all sales"
ON public.sales FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- ===== RLS: Items de venta =====
CREATE POLICY "Business members can view sale items"
ON public.sale_items FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.sales s 
        WHERE s.id = sale_id 
        AND get_branch_business_id(s.branch_id) = get_user_business_id(auth.uid())
    )
);

CREATE POLICY "Sellers can create sale items"
ON public.sale_items FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.sales s 
        WHERE s.id = sale_id 
        AND get_branch_business_id(s.branch_id) = get_user_business_id(auth.uid())
    )
);

CREATE POLICY "Super admin can manage all sale items"
ON public.sale_items FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

-- ===== Triggers para updated_at =====
CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_branch_stock_updated_at
BEFORE UPDATE ON public.branch_stock
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== Función para generar código de producto automático =====
CREATE OR REPLACE FUNCTION public.generate_product_code(_business_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_number INTEGER;
    new_code TEXT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.products
    WHERE business_id = _business_id
    AND code ~ '^PRD-[0-9]+$';
    
    new_code := 'PRD-' || LPAD(next_number::TEXT, 5, '0');
    RETURN new_code;
END;
$$;

-- ===== Función para generar número de venta =====
CREATE OR REPLACE FUNCTION public.generate_sale_number(_branch_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_number INTEGER;
    new_number TEXT;
BEGIN
    SELECT COALESCE(MAX(CAST(SUBSTRING(sale_number FROM 5) AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.sales
    WHERE branch_id = _branch_id
    AND sale_number ~ '^VTA-[0-9]+$';
    
    new_number := 'VTA-' || LPAD(next_number::TEXT, 6, '0');
    RETURN new_number;
END;
$$;

-- ===== Función para actualizar stock después de una venta =====
CREATE OR REPLACE FUNCTION public.update_stock_on_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    sale_branch_id UUID;
BEGIN
    -- Obtener branch_id de la venta
    SELECT branch_id INTO sale_branch_id
    FROM public.sales
    WHERE id = NEW.sale_id;
    
    -- Actualizar stock
    UPDATE public.branch_stock
    SET quantity = quantity - NEW.quantity,
        updated_at = now()
    WHERE branch_id = sale_branch_id
    AND product_id = NEW.product_id;
    
    -- Si no existe el registro de stock, crearlo con cantidad negativa (alerta)
    IF NOT FOUND THEN
        INSERT INTO public.branch_stock (branch_id, product_id, quantity)
        VALUES (sale_branch_id, NEW.product_id, -NEW.quantity);
    END IF;
    
    -- Registrar movimiento de inventario
    INSERT INTO public.inventory_movements (branch_id, product_id, user_id, movement_type, quantity, reference_id)
    SELECT sale_branch_id, NEW.product_id, s.user_id, 'sale', NEW.quantity, NEW.sale_id
    FROM public.sales s WHERE s.id = NEW.sale_id;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_stock_on_sale
AFTER INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.update_stock_on_sale();

-- ===== Habilitar realtime para tablas clave =====
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.branch_stock;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;