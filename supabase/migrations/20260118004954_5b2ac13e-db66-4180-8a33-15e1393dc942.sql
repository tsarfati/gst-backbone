-- Drop existing policies first, then recreate with proper restrictions
DROP POLICY IF EXISTS "Company members can view photo albums" ON public.photo_albums;
DROP POLICY IF EXISTS "Company members can create photo albums" ON public.photo_albums;
DROP POLICY IF EXISTS "Company members can update photo albums" ON public.photo_albums;
DROP POLICY IF EXISTS "Company members can delete photo albums" ON public.photo_albums;
DROP POLICY IF EXISTS "Anyone can view photo albums" ON public.photo_albums;
DROP POLICY IF EXISTS "Public can view photo albums" ON public.photo_albums;

-- Ensure RLS is enabled
ALTER TABLE public.photo_albums ENABLE ROW LEVEL SECURITY;

-- Create policy: Only authenticated company members can view photo albums
CREATE POLICY "Company members can view photo albums"
ON public.photo_albums
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.user_company_access uca ON uca.company_id = j.company_id
    WHERE j.id = photo_albums.job_id
    AND uca.user_id = auth.uid()
    AND uca.is_active = true
  )
);

-- Create policy: Company members can create photo albums
CREATE POLICY "Company members can create photo albums"
ON public.photo_albums
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.user_company_access uca ON uca.company_id = j.company_id
    WHERE j.id = job_id
    AND uca.user_id = auth.uid()
    AND uca.is_active = true
  )
);

-- Create policy: Company members can update photo albums
CREATE POLICY "Company members can update photo albums"
ON public.photo_albums
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.user_company_access uca ON uca.company_id = j.company_id
    WHERE j.id = photo_albums.job_id
    AND uca.user_id = auth.uid()
    AND uca.is_active = true
  )
);

-- Create policy: Company members can delete photo albums
CREATE POLICY "Company members can delete photo albums"
ON public.photo_albums
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.user_company_access uca ON uca.company_id = j.company_id
    WHERE j.id = photo_albums.job_id
    AND uca.user_id = auth.uid()
    AND uca.is_active = true
  )
);