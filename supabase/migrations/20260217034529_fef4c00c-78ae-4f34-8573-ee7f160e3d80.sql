
-- Add warehouse_quantity column to branch_stock
ALTER TABLE public.branch_stock 
ADD COLUMN warehouse_quantity integer NOT NULL DEFAULT 0;

-- Rename quantity to clarify it's for sale
COMMENT ON COLUMN public.branch_stock.quantity IS 'Quantity available for sale (POS)';
COMMENT ON COLUMN public.branch_stock.warehouse_quantity IS 'Quantity stored in warehouse';
