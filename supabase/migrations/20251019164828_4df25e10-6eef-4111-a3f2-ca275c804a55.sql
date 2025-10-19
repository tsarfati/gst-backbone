-- Create company-files storage bucket for PDF template assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-files', 'company-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for company-files bucket
CREATE POLICY "Authenticated users can upload to their company folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'company-files' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text
    FROM user_company_access
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Authenticated users can view company files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'company-files' AND
  (storage.foldername(name))[1] IN (
    SELECT company_id::text
    FROM user_company_access
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Company admins can delete company files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'company-files' AND
  (storage.foldername(name))[1] IN (
    SELECT uc.company_id::text
    FROM user_company_access uc
    WHERE uc.user_id = auth.uid() 
      AND uc.is_active = true
      AND uc.role IN ('admin', 'controller')
  )
);

CREATE POLICY "Company admins can update company files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'company-files' AND
  (storage.foldername(name))[1] IN (
    SELECT uc.company_id::text
    FROM user_company_access uc
    WHERE uc.user_id = auth.uid() 
      AND uc.is_active = true
      AND uc.role IN ('admin', 'controller')
  )
);