
CREATE OR REPLACE FUNCTION public.increment_feature_usage(
  _business_id UUID,
  _user_id UUID,
  _feature_key TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.assistant_feature_usage (business_id, user_id, feature_key, use_count, last_used_at)
  VALUES (_business_id, _user_id, _feature_key, 1, now())
  ON CONFLICT (business_id, user_id, feature_key)
  DO UPDATE SET
    use_count = assistant_feature_usage.use_count + 1,
    last_used_at = now();
END;
$$;
