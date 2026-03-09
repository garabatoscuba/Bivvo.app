
-- Create triggers on sale_items to deduct stock on sale
-- Postgres fires same-event triggers in alphabetical order by name

CREATE OR REPLACE TRIGGER trg_a_update_stock_on_sale
  AFTER INSERT ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_on_sale();

CREATE OR REPLACE TRIGGER trg_b_deduct_recipe_ingredients_on_sale
  AFTER INSERT ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.deduct_recipe_ingredients_on_sale();

CREATE OR REPLACE TRIGGER trg_c_create_kitchen_order_on_elaborado_sale
  AFTER INSERT ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.create_kitchen_order_on_elaborado_sale();

-- Trigger for stock restoration on sale cancellation
CREATE OR REPLACE TRIGGER trg_restore_stock_on_cancel
  AFTER UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.restore_stock_on_cancel();

-- Trigger to recalculate elaborado stock when ingredient stock changes
CREATE OR REPLACE TRIGGER trg_update_elaborado_after_ingredient_change
  AFTER UPDATE OF quantity ON public.branch_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_elaborado_after_ingredient_change();

-- Trigger for recipe ingredient list changes
CREATE OR REPLACE TRIGGER trg_update_elaborado_after_ingredient_list_change
  AFTER INSERT OR UPDATE OR DELETE ON public.recipe_ingredients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_elaborado_after_ingredient_list_change();

-- Trigger for recipe changes
CREATE OR REPLACE TRIGGER trg_update_elaborado_after_recipe_change
  AFTER INSERT OR UPDATE OR DELETE ON public.recipes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_elaborado_after_recipe_change();

-- Trigger for weighted cost on stock entry
CREATE OR REPLACE TRIGGER trg_update_ingredient_weighted_cost
  AFTER INSERT ON public.product_stock_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ingredient_weighted_cost();

-- Trigger for low stock notification
CREATE OR REPLACE TRIGGER trg_notify_low_stock
  AFTER UPDATE OF quantity ON public.branch_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_low_stock();
