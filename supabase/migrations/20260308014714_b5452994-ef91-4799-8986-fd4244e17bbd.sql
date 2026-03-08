
-- Create portal_promo_blocks table
CREATE TABLE public.portal_promo_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  block_number INTEGER NOT NULL CHECK (block_number IN (1, 2)),
  image_url TEXT,
  text_primary TEXT,
  text_secondary TEXT,
  link_target TEXT DEFAULT 'products',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (branch_id, block_number)
);

-- Enable RLS
ALTER TABLE public.portal_promo_blocks ENABLE ROW LEVEL SECURITY;

-- Owners can manage their own blocks
CREATE POLICY "Users can manage promo blocks for their business"
ON public.portal_promo_blocks
FOR ALL
TO authenticated
USING (business_id = public.get_user_business_id(auth.uid()))
WITH CHECK (business_id = public.get_user_business_id(auth.uid()));

-- Public read for active storefronts (via edge function with service role)

-- Create storage bucket for promo images
INSERT INTO storage.buckets (id, name, public)
VALUES ('portal-promo', 'portal-promo', true);

-- Storage policies for portal-promo bucket
CREATE POLICY "Authenticated users can upload promo images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'portal-promo');

CREATE POLICY "Authenticated users can update promo images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'portal-promo');

CREATE POLICY "Public can view promo images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'portal-promo');

CREATE POLICY "Authenticated users can delete promo images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'portal-promo');

-- Updated_at trigger
CREATE TRIGGER update_portal_promo_blocks_updated_at
  BEFORE UPDATE ON public.portal_promo_blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
