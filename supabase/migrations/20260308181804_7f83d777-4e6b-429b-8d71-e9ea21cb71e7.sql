ALTER TABLE salary_modalities DROP CONSTRAINT salary_modalities_applies_to_check;

ALTER TABLE salary_modalities ADD CONSTRAINT salary_modalities_applies_to_check CHECK (applies_to IN ('services', 'products', 'both', 'prints', 'services_prints', 'products_prints', 'all'));