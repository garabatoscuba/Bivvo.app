
-- Fix: businesses.owner_id should SET NULL when the referenced profile is deleted
ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS fk_business_owner;

ALTER TABLE public.businesses
  ADD CONSTRAINT fk_business_owner
  FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
