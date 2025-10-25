-- Create storage bucket for vendor compliance documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('vendor-compliance-docs', 'vendor-compliance-docs', false);

-- Allow authenticated users to upload vendor compliance documents
CREATE POLICY "Users can upload vendor compliance documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vendor-compliance-docs');

-- Allow authenticated users to view vendor compliance documents
CREATE POLICY "Users can view vendor compliance documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'vendor-compliance-docs');

-- Allow authenticated users to update vendor compliance documents
CREATE POLICY "Users can update vendor compliance documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'vendor-compliance-docs');

-- Allow authenticated users to delete vendor compliance documents
CREATE POLICY "Users can delete vendor compliance documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'vendor-compliance-docs');