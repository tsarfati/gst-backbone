
-- Create storage bucket for bid attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('bid-attachments', 'bid-attachments', true);

-- Allow authenticated users to upload bid attachments
CREATE POLICY "Authenticated users can upload bid attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'bid-attachments' AND auth.role() = 'authenticated');

-- Allow authenticated users to read bid attachments
CREATE POLICY "Authenticated users can read bid attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'bid-attachments' AND auth.role() = 'authenticated');

-- Allow authenticated users to delete their bid attachments
CREATE POLICY "Authenticated users can delete bid attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'bid-attachments' AND auth.role() = 'authenticated');
