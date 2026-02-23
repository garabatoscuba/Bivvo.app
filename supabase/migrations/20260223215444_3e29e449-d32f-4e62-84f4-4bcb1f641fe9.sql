-- Add country column to profiles
ALTER TABLE public.profiles ADD COLUMN country text DEFAULT NULL;

-- Update Vision Habana business type to copy_shop
UPDATE public.businesses SET business_type = 'copy_shop' WHERE id = '03ab1b9d-c0ff-412c-9b78-c86d320dc41c';