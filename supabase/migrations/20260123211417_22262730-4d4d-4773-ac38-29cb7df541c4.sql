-- Add RLS policies for job-related storage buckets

-- Create job-banners bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('job-banners', 'job-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for job-banners bucket
CREATE POLICY "Authenticated users can upload job banners"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'job-banners');

CREATE POLICY "Authenticated users can update job banners"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'job-banners');

CREATE POLICY "Anyone can view job banners"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'job-banners');

CREATE POLICY "Authenticated users can delete job banners"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'job-banners');

-- Also add policies for company-files if not already set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Authenticated users can upload company files'
    AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Authenticated users can upload company files"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'company-files');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Authenticated users can update company files'
    AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Authenticated users can update company files"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'company-files');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Authenticated users can delete company files'
    AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Authenticated users can delete company files"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'company-files');
  END IF;
END $$;