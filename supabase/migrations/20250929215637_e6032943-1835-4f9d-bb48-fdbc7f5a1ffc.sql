-- Create storage bucket for subcontract files
INSERT INTO storage.buckets (id, name, public)
VALUES ('subcontract-files', 'subcontract-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for subcontract files
CREATE POLICY "Users can upload subcontract files for their company"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'subcontract-files' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text 
    FROM user_company_access 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can view subcontract files for their company"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'subcontract-files' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text 
    FROM user_company_access 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can update subcontract files for their company"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'subcontract-files' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text 
    FROM user_company_access 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can delete subcontract files for their company"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'subcontract-files' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text 
    FROM user_company_access 
    WHERE user_id = auth.uid() AND is_active = true
  )
);