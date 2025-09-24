-- Drop existing storage policies for punch-photos if they exist
DROP POLICY IF EXISTS "Users can upload their own punch photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own punch photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own punch photos" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all punch photos" ON storage.objects;

-- Create storage policies for punch-photos bucket
-- Allow users to upload their own punch photos
CREATE POLICY "Users can upload their own punch photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'punch-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own punch photos
CREATE POLICY "Users can view their own punch photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'punch-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own punch photos
CREATE POLICY "Users can update their own punch photos"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'punch-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow admins and managers to view all punch photos
CREATE POLICY "Admins can view all punch photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'punch-photos' 
  AND (
    public.has_role(auth.uid(), 'admin'::public.user_role)
    OR public.has_role(auth.uid(), 'controller'::public.user_role)
    OR public.has_role(auth.uid(), 'project_manager'::public.user_role)
  )
);