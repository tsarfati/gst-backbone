-- Create subcontract-files storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('subcontract-files', 'subcontract-files', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view subcontract files in their company" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload subcontract files to their company" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete subcontract files in their company" ON storage.objects;

-- Create RLS policies for subcontract files
CREATE POLICY "Users can view subcontract files in their company"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'subcontract-files' AND
  auth.uid() IN (
    SELECT uca.user_id 
    FROM user_company_access uca
    WHERE uca.company_id::text = (storage.foldername(name))[1]
      AND uca.is_active = true
  )
);

CREATE POLICY "Users can upload subcontract files to their company"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'subcontract-files' AND
  auth.uid() IN (
    SELECT uca.user_id 
    FROM user_company_access uca
    WHERE uca.company_id::text = (storage.foldername(name))[1]
      AND uca.is_active = true
      AND uca.role IN ('admin', 'controller', 'project_manager', 'company_admin')
  )
);

CREATE POLICY "Users can delete subcontract files in their company"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'subcontract-files' AND
  auth.uid() IN (
    SELECT uca.user_id 
    FROM user_company_access uca
    WHERE uca.company_id::text = (storage.foldername(name))[1]
      AND uca.is_active = true
      AND uca.role IN ('admin', 'controller', 'company_admin')
  )
);