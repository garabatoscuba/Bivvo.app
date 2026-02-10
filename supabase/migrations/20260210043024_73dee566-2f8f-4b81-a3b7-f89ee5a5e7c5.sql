-- Create the missing trigger for stock deduction on sale
CREATE TRIGGER on_sale_item_insert
AFTER INSERT ON public.sale_items
FOR EACH ROW
EXECUTE FUNCTION public.update_stock_on_sale();