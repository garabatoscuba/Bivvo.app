
-- Add slug columns
ALTER TABLE public.businesses ADD COLUMN slug TEXT UNIQUE;
ALTER TABLE public.branches ADD COLUMN slug TEXT;

-- Add unique constraint for branch slug within a business
ALTER TABLE public.branches ADD CONSTRAINT branches_business_slug_unique UNIQUE (business_id, slug);

-- Function to generate slug from name
CREATE OR REPLACE FUNCTION public.generate_slug(input TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  result TEXT;
BEGIN
  result := lower(trim(input));
  result := regexp_replace(result, '[áàâä]', 'a', 'g');
  result := regexp_replace(result, '[éèêë]', 'e', 'g');
  result := regexp_replace(result, '[íìîï]', 'i', 'g');
  result := regexp_replace(result, '[óòôö]', 'o', 'g');
  result := regexp_replace(result, '[úùûü]', 'u', 'g');
  result := regexp_replace(result, '[ñ]', 'n', 'g');
  result := regexp_replace(result, '[^a-z0-9\s-]', '', 'g');
  result := regexp_replace(result, '[\s]+', '-', 'g');
  result := regexp_replace(result, '-+', '-', 'g');
  result := trim(BOTH '-' FROM result);
  RETURN result;
END;
$$;

-- Auto-set slug on business insert/update if slug is null
CREATE OR REPLACE FUNCTION public.set_business_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := generate_slug(NEW.name);
    final_slug := base_slug;
    LOOP
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.businesses WHERE slug = final_slug AND id != NEW.id);
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;
    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_business_slug
BEFORE INSERT OR UPDATE ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.set_business_slug();

-- Auto-set slug on branch insert/update if slug is null
CREATE OR REPLACE FUNCTION public.set_branch_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INT := 0;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := generate_slug(NEW.name);
    final_slug := base_slug;
    LOOP
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.branches WHERE slug = final_slug AND business_id = NEW.business_id AND id != NEW.id);
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    END LOOP;
    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_branch_slug
BEFORE INSERT OR UPDATE ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.set_branch_slug();

-- Backfill existing records
UPDATE public.businesses SET slug = NULL WHERE slug IS NULL;
UPDATE public.branches SET slug = NULL WHERE slug IS NULL;
