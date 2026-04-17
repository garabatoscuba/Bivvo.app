CREATE OR REPLACE FUNCTION public.search_public_catalog(q text)
RETURNS TABLE(
  kind text,
  id uuid,
  name text,
  price numeric,
  business_id uuid,
  business_name text,
  business_slug text,
  business_type text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH active_biz AS (
    SELECT DISTINCT b.id, b.name, b.slug, b.business_type, b.keywords
    FROM public.businesses b
    JOIN public.branches br ON br.business_id = b.id
    JOIN public.store_settings ss ON ss.branch_id = br.id AND ss.is_active = true
    WHERE b.is_active = true
  ),
  biz_match AS (
    SELECT 'business'::text AS kind, ab.id, ab.name, NULL::numeric AS price,
           ab.id AS business_id, ab.name AS business_name, ab.slug AS business_slug,
           ab.business_type
    FROM active_biz ab
    WHERE ab.name ILIKE '%' || q || '%' OR COALESCE(ab.keywords,'') ILIKE '%' || q || '%'
    ORDER BY ab.name
    LIMIT 8
  ),
  prod_match AS (
    SELECT 'product'::text AS kind, p.id, p.name, p.sale_price AS price,
           ab.id AS business_id, ab.name AS business_name, ab.slug AS business_slug,
           ab.business_type
    FROM public.products p
    JOIN active_biz ab ON ab.id = p.business_id
    WHERE p.name ILIKE '%' || q || '%'
      AND p.tipo IN ('reventa','elaborado','granel')
      AND p.status = 'for_sale'::product_status
    ORDER BY p.name
    LIMIT 10
  ),
  svc_match AS (
    SELECT 'service'::text AS kind, sc.id, sc.name, sc.fixed_price AS price,
           ab.id AS business_id, ab.name AS business_name, ab.slug AS business_slug,
           ab.business_type
    FROM public.service_categories sc
    JOIN active_biz ab ON ab.id = sc.business_id
    WHERE sc.name ILIKE '%' || q || '%'
    ORDER BY sc.name
    LIMIT 10
  )
  SELECT * FROM biz_match
  UNION ALL SELECT * FROM prod_match
  UNION ALL SELECT * FROM svc_match;
$$;

GRANT EXECUTE ON FUNCTION public.search_public_catalog(text) TO anon, authenticated;