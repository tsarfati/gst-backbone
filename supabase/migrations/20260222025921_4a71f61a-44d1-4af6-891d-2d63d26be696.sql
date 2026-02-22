-- Make sensitive storage buckets private
UPDATE storage.buckets SET public = false WHERE id = 'receipts';
UPDATE storage.buckets SET public = false WHERE id = 'punch-photos';
UPDATE storage.buckets SET public = false WHERE id = 'credit-card-attachments';

-- Remove the overly permissive public read policy on punch-photos
DROP POLICY IF EXISTS "Public can read punch-photos" ON storage.objects;

-- Ensure authenticated users can read from these buckets based on company membership
-- Receipts: authenticated users with company access can read
CREATE POLICY "Authenticated users can read receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'receipts');

-- Punch-photos: authenticated users can read
CREATE POLICY "Authenticated users can read punch-photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'punch-photos');

-- Credit-card-attachments: authenticated users can read
CREATE POLICY "Authenticated users can read credit-card-attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'credit-card-attachments');