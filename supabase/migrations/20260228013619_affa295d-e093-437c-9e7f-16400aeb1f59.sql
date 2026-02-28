-- Backfill employee auth link using existing internal account emails
UPDATE public.employees e
SET auth_user_id = p.user_id
FROM public.profiles p
WHERE e.auth_user_id IS NULL
  AND e.email IS NOT NULL
  AND lower(e.email) = lower(p.email);

-- Ensure fast lookup by auth uid
CREATE INDEX IF NOT EXISTS idx_employees_auth_user_id
ON public.employees (auth_user_id);

-- Ensure employee accounts have the role that matches employees.position
INSERT INTO public.user_roles (user_id, role)
SELECT
  p.user_id,
  CASE
    WHEN lower(e.position) IN ('manager', 'gerente') THEN 'manager'::public.app_role
    WHEN lower(e.position) IN ('accountant', 'contable') THEN 'accountant'::public.app_role
    ELSE 'seller'::public.app_role
  END AS role
FROM public.employees e
JOIN public.profiles p ON lower(p.email) = lower(e.email)
WHERE lower(p.email) LIKE '%@bivoo.app'
ON CONFLICT (user_id, role) DO NOTHING;

-- Remove accidental owner role from internal employee accounts
DELETE FROM public.user_roles ur
USING public.profiles p
WHERE ur.user_id = p.user_id
  AND ur.role = 'owner'::public.app_role
  AND lower(p.email) LIKE '%@bivoo.app'
  AND EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.auth_user_id = p.user_id
       OR (e.email IS NOT NULL AND lower(e.email) = lower(p.email))
  );

-- Resolve business context for @bivoo employee accounts by employees.auth_user_id
CREATE OR REPLACE FUNCTION public.get_user_business_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH p AS (
    SELECT business_id, email
    FROM public.profiles
    WHERE user_id = _user_id
    LIMIT 1
  )
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM p WHERE lower(email) LIKE '%@bivoo.app') THEN
      COALESCE(
        (SELECT e.business_id FROM public.employees e WHERE e.auth_user_id = _user_id LIMIT 1),
        (SELECT business_id FROM p)
      )
    ELSE
      (SELECT business_id FROM p)
  END
$function$;

-- Employee membership check should prioritize auth_user_id and keep email fallback for legacy rows
CREATE OR REPLACE FUNCTION public.is_employee_of_business(_user_id uuid, _business_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.employees e
    WHERE e.business_id = _business_id
      AND (
        e.auth_user_id = _user_id
        OR (
          e.auth_user_id IS NULL
          AND EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.user_id = _user_id
              AND lower(p.email) = lower(e.email)
          )
        )
      )
  )
$function$;