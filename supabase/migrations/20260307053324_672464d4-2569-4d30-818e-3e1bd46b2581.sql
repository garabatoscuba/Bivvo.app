
-- Create storage bucket for expense receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('expense-receipts', 'expense-receipts', true);

-- Allow authenticated users to upload receipts
CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'expense-receipts');

-- Allow public read access to receipts
CREATE POLICY "Public can read receipts"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'expense-receipts');

-- Allow owners to delete their receipts
CREATE POLICY "Authenticated users can delete receipts"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'expense-receipts');
