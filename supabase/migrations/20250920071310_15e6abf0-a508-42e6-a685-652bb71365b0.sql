-- Fix storage bucket policy to allow user uploads to receipts bucket
CREATE POLICY "Users can upload to receipts bucket" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update objects in receipts bucket" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view objects in receipts bucket" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'receipts' AND auth.uid() IS NOT NULL);