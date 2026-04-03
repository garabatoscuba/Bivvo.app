
ALTER TABLE service_entries ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;
ALTER TABLE service_entries ADD COLUMN IF NOT EXISTS archived_at timestamptz;

INSERT INTO insumo_areas (business_id, name, icon, color, is_internal)
SELECT b.id, 'Uso Interno', 'Home', 'primary', true
FROM businesses b
WHERE NOT EXISTS (
  SELECT 1 FROM insumo_areas ia 
  WHERE ia.business_id = b.id AND ia.is_internal = true
);
