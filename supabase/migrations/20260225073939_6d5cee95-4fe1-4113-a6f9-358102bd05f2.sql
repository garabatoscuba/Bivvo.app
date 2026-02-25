-- Update slug for Vision Habana
UPDATE businesses SET slug = generate_slug('Vision Habana') WHERE id = '03ab1b9d-c0ff-412c-9b78-c86d320dc41c';

-- Also update other renamed businesses
UPDATE businesses SET slug = generate_slug(name) WHERE slug LIKE 'negocio-de-prueba%' AND name != 'Negocio de prueba';

-- Create trigger to auto-update slug when business name changes
CREATE OR REPLACE FUNCTION update_business_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    NEW.slug := generate_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_business_slug ON businesses;
CREATE TRIGGER trg_update_business_slug
  BEFORE UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION update_business_slug();