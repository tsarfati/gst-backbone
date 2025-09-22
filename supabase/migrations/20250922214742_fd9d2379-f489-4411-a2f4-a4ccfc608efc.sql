-- Add storage policies for theme files in the avatars bucket
CREATE POLICY "Users can upload theme logos"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'avatars' 
  AND (storage.foldername(name))[1] = 'theme-logos'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Users can upload theme banners"
ON storage.objects
FOR INSERT 
TO public
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'theme-banners'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Users can update theme logos"
ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'theme-logos'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Users can update theme banners"
ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'theme-banners'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Users can delete theme logos"
ON storage.objects
FOR DELETE
TO public
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'theme-logos'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

CREATE POLICY "Users can delete theme banners"
ON storage.objects
FOR DELETE
TO public
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = 'theme-banners'
  AND auth.uid()::text = (storage.foldername(name))[2]
);