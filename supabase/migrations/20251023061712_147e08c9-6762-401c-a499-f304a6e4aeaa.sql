-- Create public bucket for credit card attachments and policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'credit-card-attachments'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('credit-card-attachments', 'credit-card-attachments', true);
  END IF;
END $$;

-- Public read policy for the bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
      AND policyname = 'Public read for credit-card-attachments'
  ) THEN
    CREATE POLICY "Public read for credit-card-attachments"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'credit-card-attachments');
  END IF;
END $$;

-- Authenticated users can upload to the bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
      AND policyname = 'Authenticated upload to credit-card-attachments'
  ) THEN
    CREATE POLICY "Authenticated upload to credit-card-attachments"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
      bucket_id = 'credit-card-attachments' AND auth.role() = 'authenticated'
    );
  END IF;
END $$;

-- Authenticated users can update objects in the bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
      AND policyname = 'Authenticated update credit-card-attachments'
  ) THEN
    CREATE POLICY "Authenticated update credit-card-attachments"
    ON storage.objects
    FOR UPDATE
    USING (
      bucket_id = 'credit-card-attachments' AND auth.role() = 'authenticated'
    )
    WITH CHECK (
      bucket_id = 'credit-card-attachments' AND auth.role() = 'authenticated'
    );
  END IF;
END $$;

-- Authenticated users can delete objects in the bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' 
      AND policyname = 'Authenticated delete credit-card-attachments'
  ) THEN
    CREATE POLICY "Authenticated delete credit-card-attachments"
    ON storage.objects
    FOR DELETE
    USING (
      bucket_id = 'credit-card-attachments' AND auth.role() = 'authenticated'
    );
  END IF;
END $$;