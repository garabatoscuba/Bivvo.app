
-- SQL unit conversion function mirroring src/lib/unitConversion.ts
CREATE OR REPLACE FUNCTION public.convert_recipe_units(
  _qty NUMERIC,
  _from_unit TEXT,
  _to_unit TEXT
) RETURNS NUMERIC
LANGUAGE plpgsql IMMUTABLE
SET search_path TO 'public'
AS $$
DECLARE
  _from TEXT;
  _to TEXT;
  _from_base NUMERIC;
  _to_base NUMERIC;
  _from_cat TEXT;
  _to_cat TEXT;
BEGIN
  -- Normalize from unit
  _from := lower(trim(_from_unit));
  _to   := lower(trim(_to_unit));

  -- Aliases
  IF _from IN ('gramo','gramos') THEN _from := 'g'; END IF;
  IF _from IN ('kilogramo','kilogramos') THEN _from := 'kg'; END IF;
  IF _from IN ('libra','libras') THEN _from := 'lb'; END IF;
  IF _from IN ('onza','onzas') THEN _from := 'oz'; END IF;
  IF _from IN ('mililitro','mililitros') THEN _from := 'ml'; END IF;
  IF _from IN ('litro','litros') THEN _from := 'l'; END IF;
  IF _from IN ('galon','galones','galón') THEN _from := 'galon'; END IF;
  IF _from IN ('pieza','piezas','pza') THEN _from := 'pieza'; END IF;
  IF _from IN ('unidad','unidades','ud','u') THEN _from := 'unidad'; END IF;

  IF _to IN ('gramo','gramos') THEN _to := 'g'; END IF;
  IF _to IN ('kilogramo','kilogramos') THEN _to := 'kg'; END IF;
  IF _to IN ('libra','libras') THEN _to := 'lb'; END IF;
  IF _to IN ('onza','onzas') THEN _to := 'oz'; END IF;
  IF _to IN ('mililitro','mililitros') THEN _to := 'ml'; END IF;
  IF _to IN ('litro','litros') THEN _to := 'l'; END IF;
  IF _to IN ('galon','galones','galón') THEN _to := 'galon'; END IF;
  IF _to IN ('pieza','piezas','pza') THEN _to := 'pieza'; END IF;
  IF _to IN ('unidad','unidades','ud','u') THEN _to := 'unidad'; END IF;

  -- Same unit, no conversion needed
  IF _from = _to THEN RETURN _qty; END IF;

  -- Lookup factors & categories
  SELECT
    CASE _from
      WHEN 'g' THEN 1 WHEN 'kg' THEN 1000 WHEN 'lb' THEN 453.592 WHEN 'oz' THEN 28.3495
      WHEN 'ml' THEN 1 WHEN 'l' THEN 1000 WHEN 'fl oz' THEN 29.5735 WHEN 'galon' THEN 3785.41
      WHEN 'pieza' THEN 1 WHEN 'unidad' THEN 1
      ELSE NULL
    END,
    CASE _from
      WHEN 'g' THEN 'weight' WHEN 'kg' THEN 'weight' WHEN 'lb' THEN 'weight' WHEN 'oz' THEN 'weight'
      WHEN 'ml' THEN 'volume' WHEN 'l' THEN 'volume' WHEN 'fl oz' THEN 'volume' WHEN 'galon' THEN 'volume'
      WHEN 'pieza' THEN 'unit' WHEN 'unidad' THEN 'unit'
      ELSE 'unknown'
    END
  INTO _from_base, _from_cat;

  SELECT
    CASE _to
      WHEN 'g' THEN 1 WHEN 'kg' THEN 1000 WHEN 'lb' THEN 453.592 WHEN 'oz' THEN 28.3495
      WHEN 'ml' THEN 1 WHEN 'l' THEN 1000 WHEN 'fl oz' THEN 29.5735 WHEN 'galon' THEN 3785.41
      WHEN 'pieza' THEN 1 WHEN 'unidad' THEN 1
      ELSE NULL
    END,
    CASE _to
      WHEN 'g' THEN 'weight' WHEN 'kg' THEN 'weight' WHEN 'lb' THEN 'weight' WHEN 'oz' THEN 'weight'
      WHEN 'ml' THEN 'volume' WHEN 'l' THEN 'volume' WHEN 'fl oz' THEN 'volume' WHEN 'galon' THEN 'volume'
      WHEN 'pieza' THEN 'unit' WHEN 'unidad' THEN 'unit'
      ELSE 'unknown'
    END
  INTO _to_base, _to_cat;

  -- Unknown units or incompatible categories: return qty as-is (fallback)
  IF _from_base IS NULL OR _to_base IS NULL THEN RETURN _qty; END IF;
  IF _from_cat != _to_cat THEN RETURN _qty; END IF;
  IF _from_cat = 'unit' THEN RETURN _qty; END IF;

  -- Convert: qty * from_base / to_base
  RETURN (_qty * _from_base) / _to_base;
END;
$$;
