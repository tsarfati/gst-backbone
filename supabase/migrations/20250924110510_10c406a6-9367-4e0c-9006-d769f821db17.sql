-- Make punch-photos bucket public so images can load in the browser
UPDATE storage.buckets SET public = true WHERE id = 'punch-photos';

-- Ensure public read access policy exists (idempotent create)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' 
      AND tablename = 'objects' 
      AND policyname = 'Public can read punch-photos'
  ) THEN
    CREATE POLICY "Public can read punch-photos"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'punch-photos');
  END IF;
END $$;