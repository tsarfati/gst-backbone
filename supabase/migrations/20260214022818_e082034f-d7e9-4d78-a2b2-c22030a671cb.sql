
-- Create storage bucket for bid attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('bid-attachments', 'bid-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload bid attachments
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload bid attachments" ON storage.objects;
  CREATE POLICY "Authenticated users can upload bid attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'bid-attachments' AND auth.role() = 'authenticated');
EXCEPTION
  WHEN duplicate_object OR insufficient_privilege THEN NULL;
END $$;

-- Allow authenticated users to read bid attachments
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can read bid attachments" ON storage.objects;
  CREATE POLICY "Authenticated users can read bid attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'bid-attachments' AND auth.role() = 'authenticated');
EXCEPTION
  WHEN duplicate_object OR insufficient_privilege THEN NULL;
END $$;

-- Allow authenticated users to delete their bid attachments
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can delete bid attachments" ON storage.objects;
  CREATE POLICY "Authenticated users can delete bid attachments"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'bid-attachments' AND auth.role() = 'authenticated');
EXCEPTION
  WHEN duplicate_object OR insufficient_privilege THEN NULL;
END $$;
