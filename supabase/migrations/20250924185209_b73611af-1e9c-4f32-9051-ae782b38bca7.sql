-- Add missing storage policies for company-logos bucket uploads
CREATE POLICY "Admins and controllers can upload company logos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'company-logos' AND 
  (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
);

CREATE POLICY "Admins and controllers can update company logos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'company-logos' AND 
  (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
);

CREATE POLICY "Admins and controllers can delete company logos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'company-logos' AND 
  (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
);