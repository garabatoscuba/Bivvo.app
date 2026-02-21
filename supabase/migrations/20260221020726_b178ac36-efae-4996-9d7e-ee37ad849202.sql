
-- Add business_type column to businesses table
ALTER TABLE public.businesses 
ADD COLUMN business_type TEXT NOT NULL DEFAULT 'store';

-- Add a comment for documentation
COMMENT ON COLUMN public.businesses.business_type IS 'Type of business: store, gym, etc.';
