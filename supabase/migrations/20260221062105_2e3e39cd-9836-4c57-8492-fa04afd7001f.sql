
-- Add hero image, editable title/subtitle, and font settings to store_settings
ALTER TABLE public.store_settings
  ADD COLUMN hero_image_url text DEFAULT NULL,
  ADD COLUMN hero_title text DEFAULT NULL,
  ADD COLUMN hero_subtitle text DEFAULT NULL,
  ADD COLUMN font_heading text DEFAULT 'Lora',
  ADD COLUMN font_body text DEFAULT 'Work Sans';
