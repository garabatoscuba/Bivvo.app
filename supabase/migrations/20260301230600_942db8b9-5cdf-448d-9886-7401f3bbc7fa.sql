-- Remove duplicate constraint
ALTER TABLE public.module_plugin_pricing DROP CONSTRAINT IF EXISTS module_plugin_pricing_entity_id_plan_type_key;

-- Add updated_at trigger
CREATE TRIGGER update_module_plugin_pricing_updated_at
  BEFORE UPDATE ON public.module_plugin_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();