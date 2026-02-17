
-- Add CASCADE delete to all tables referencing businesses
ALTER TABLE public.branches DROP CONSTRAINT IF EXISTS branches_business_id_fkey;
ALTER TABLE public.branches ADD CONSTRAINT branches_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;

ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_business_id_fkey;
ALTER TABLE public.products ADD CONSTRAINT products_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;

ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_business_id_fkey;
ALTER TABLE public.categories ADD CONSTRAINT categories_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;

ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_business_id_fkey;
ALTER TABLE public.employees ADD CONSTRAINT employees_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;

ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_business_id_fkey;
ALTER TABLE public.customers ADD CONSTRAINT customers_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_business_id_fkey;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES public.businesses(id) ON DELETE CASCADE;

-- Add CASCADE from branches to branch_stock, inventory_movements, sales
ALTER TABLE public.branch_stock DROP CONSTRAINT IF EXISTS branch_stock_branch_id_fkey;
ALTER TABLE public.branch_stock ADD CONSTRAINT branch_stock_branch_id_fkey 
  FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_branch_id_fkey;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_branch_id_fkey 
  FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_branch_id_fkey;
ALTER TABLE public.sales ADD CONSTRAINT sales_branch_id_fkey 
  FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON DELETE CASCADE;

-- Add CASCADE from sales to sale_items
ALTER TABLE public.sale_items DROP CONSTRAINT IF EXISTS sale_items_sale_id_fkey;
ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_sale_id_fkey 
  FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;

-- Add CASCADE from products to branch_stock and inventory_movements
ALTER TABLE public.branch_stock DROP CONSTRAINT IF EXISTS branch_stock_product_id_fkey;
ALTER TABLE public.branch_stock ADD CONSTRAINT branch_stock_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_product_id_fkey;
ALTER TABLE public.inventory_movements ADD CONSTRAINT inventory_movements_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

ALTER TABLE public.sale_items DROP CONSTRAINT IF EXISTS sale_items_product_id_fkey;
ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- Add DELETE policy for super admin on businesses
CREATE POLICY "Super admin can delete businesses"
ON public.businesses FOR DELETE
USING (is_super_admin(auth.uid()));
