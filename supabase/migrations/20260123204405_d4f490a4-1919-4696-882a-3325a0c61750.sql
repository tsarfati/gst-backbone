-- Add RLS policies for the company-logos storage bucket to allow authenticated users to upload

-- Policy to allow authenticated users to upload files
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload company logos" ON storage.objects;
  CREATE POLICY "Authenticated users can upload company logos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'company-logos');
EXCEPTION
  WHEN duplicate_object OR insufficient_privilege THEN NULL;
END $$;

-- Policy to allow authenticated users to update their files
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can update company logos" ON storage.objects;
  CREATE POLICY "Authenticated users can update company logos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'company-logos');
EXCEPTION
  WHEN duplicate_object OR insufficient_privilege THEN NULL;
END $$;

-- Policy to allow anyone to view company logos (they are public)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Anyone can view company logos" ON storage.objects;
  CREATE POLICY "Anyone can view company logos"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'company-logos');
EXCEPTION
  WHEN duplicate_object OR insufficient_privilege THEN NULL;
END $$;

-- Policy to allow authenticated users to delete their files
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can delete company logos" ON storage.objects;
  CREATE POLICY "Authenticated users can delete company logos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'company-logos');
EXCEPTION
  WHEN duplicate_object OR insufficient_privilege THEN NULL;
END $$;
