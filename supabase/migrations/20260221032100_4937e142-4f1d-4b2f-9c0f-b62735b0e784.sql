
-- Add branding and social fields to store_settings for the public storefront
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS accent_color text NOT NULL DEFAULT '#18181b',
  ADD COLUMN IF NOT EXISTS about_text text,
  ADD COLUMN IF NOT EXISTS social_instagram text,
  ADD COLUMN IF NOT EXISTS social_facebook text,
  ADD COLUMN IF NOT EXISTS social_tiktok text,
  ADD COLUMN IF NOT EXISTS social_twitter text;
