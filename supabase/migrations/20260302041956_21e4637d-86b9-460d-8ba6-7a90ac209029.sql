
UPDATE business_type_configs
SET module_ids = module_ids || ARRAY['b0a7a12c-19e9-4bf5-9a9d-3d4089c80fbf']::uuid[]
WHERE key IN ('store', 'copy_shop', 'gym')
  AND NOT ('b0a7a12c-19e9-4bf5-9a9d-3d4089c80fbf'::uuid = ANY(module_ids));

INSERT INTO module_plugin_pricing (entity_id, entity_type, plan_type, availability, monthly_price)
VALUES
  ('b0a7a12c-19e9-4bf5-9a9d-3d4089c80fbf', 'module', 'free', 'included', 0),
  ('b0a7a12c-19e9-4bf5-9a9d-3d4089c80fbf', 'module', 'basic', 'included', 0),
  ('b0a7a12c-19e9-4bf5-9a9d-3d4089c80fbf', 'module', 'professional', 'included', 0)
ON CONFLICT DO NOTHING;
