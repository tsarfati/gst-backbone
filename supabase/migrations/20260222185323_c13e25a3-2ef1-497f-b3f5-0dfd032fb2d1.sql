-- Allow public (anonymous) read access to avatar files stored in punch-photos bucket
-- This fixes the issue where the external Punch Clock app uploads avatars to punch-photos
-- but the public URL returns 403 because the bucket is private
CREATE POLICY "Public read access to avatar files in punch-photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'punch-photos'
  AND (name LIKE 'avatars/%')
);