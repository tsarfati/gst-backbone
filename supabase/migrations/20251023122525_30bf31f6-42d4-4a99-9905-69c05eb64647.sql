-- Create public bucket for credit card attachments (idempotent)
insert into storage.buckets (id, name, public)
values ('credit-card-attachments', 'credit-card-attachments', true)
on conflict (id) do nothing;

-- Policies: create only if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Public read credit-card-attachments'
  ) THEN
    CREATE POLICY "Public read credit-card-attachments"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'credit-card-attachments');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Auth insert credit-card-attachments'
  ) THEN
    CREATE POLICY "Auth insert credit-card-attachments"
    ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'credit-card-attachments');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Auth update credit-card-attachments'
  ) THEN
    CREATE POLICY "Auth update credit-card-attachments"
    ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'credit-card-attachments');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Auth delete credit-card-attachments'
  ) THEN
    CREATE POLICY "Auth delete credit-card-attachments"
    ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'credit-card-attachments');
  END IF;
END $$;