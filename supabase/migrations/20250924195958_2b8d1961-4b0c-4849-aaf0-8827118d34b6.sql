-- Create storage policies for PIN authentication using the correct syntax

-- Allow PIN users (unauthenticated) to upload to punch-photos bucket
CREATE POLICY "Allow PIN users to upload punch photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'punch-photos');

-- Allow PIN users to view punch photos they uploaded
CREATE POLICY "Allow PIN users to view punch photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'punch-photos');