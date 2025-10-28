-- Ensure RLS and visibility for job photo features
-- Enable RLS (no-op if already enabled)
ALTER TABLE public.photo_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_comments ENABLE ROW LEVEL SECURITY;

-- Allow company members (with active access) to view photo albums for their jobs
CREATE POLICY "Company members can view photo albums"
ON public.photo_albums
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.user_company_access uca
      ON uca.company_id = j.company_id
    WHERE j.id = photo_albums.job_id
      AND uca.user_id = auth.uid()
      AND uca.is_active = true
  )
);

-- Allow company members to view job photos for their jobs
CREATE POLICY "Company members can view job photos"
ON public.job_photos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.user_company_access uca
      ON uca.company_id = j.company_id
    WHERE j.id = job_photos.job_id
      AND uca.user_id = auth.uid()
      AND uca.is_active = true
  )
);

-- Allow company members to view photo comments related to their job photos
CREATE POLICY "Company members can view photo comments"
ON public.photo_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.job_photos p
    JOIN public.jobs j ON j.id = p.job_id
    JOIN public.user_company_access uca ON uca.company_id = j.company_id
    WHERE p.id = photo_comments.photo_id
      AND uca.user_id = auth.uid()
      AND uca.is_active = true
  )
);

-- Allow company members to insert job photos (client-side uploads)
CREATE POLICY "Company members can insert job photos"
ON public.job_photos
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.user_company_access uca
      ON uca.company_id = j.company_id
    WHERE j.id = job_id
      AND uca.user_id = auth.uid()
      AND uca.is_active = true
  )
);

-- Allow company members to create photo albums
CREATE POLICY "Company members can insert photo albums"
ON public.photo_albums
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.user_company_access uca
      ON uca.company_id = j.company_id
    WHERE j.id = job_id
      AND uca.user_id = auth.uid()
      AND uca.is_active = true
  )
);