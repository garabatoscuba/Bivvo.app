
-- Create a simple function that returns the server's current timestamp
CREATE OR REPLACE FUNCTION public.get_server_now()
RETURNS timestamp with time zone
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT now()
$$;
