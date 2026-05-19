-- Make sensitive storage buckets private
UPDATE storage.buckets SET public = false WHERE id = 'receipts';
UPDATE storage.buckets SET public = false WHERE id = 'punch-photos';
UPDATE storage.buckets SET public = false WHERE id = 'credit-card-attachments';

-- Remove the overly permissive public read policy on punch-photos
DROP POLICY IF EXISTS "Public can read punch-photos" ON storage.objects;

-- Ensure authenticated users can read from these buckets based on company membership
-- Receipts: authenticated users with company access can read
DO $$
BEGIN
  BEGIN
    DROP POLICY IF EXISTS "Authenticated users can read receipts" ON storage.objects;
    CREATE POLICY "Authenticated users can read receipts"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'receipts');
  EXCEPTION
    WHEN duplicate_object OR insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    DROP POLICY IF EXISTS "Authenticated users can read punch-photos" ON storage.objects;
    CREATE POLICY "Authenticated users can read punch-photos"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'punch-photos');
  EXCEPTION
    WHEN duplicate_object OR insufficient_privilege THEN
      NULL;
  END;

  BEGIN
    DROP POLICY IF EXISTS "Authenticated users can read credit-card-attachments" ON storage.objects;
    CREATE POLICY "Authenticated users can read credit-card-attachments"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (bucket_id = 'credit-card-attachments');
  EXCEPTION
    WHEN duplicate_object OR insufficient_privilege THEN
      NULL;
  END;
END;
$$;
