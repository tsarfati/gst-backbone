-- Allow users with job access to move photos between albums for the same job.
-- Existing schema had SELECT/INSERT/DELETE coverage for job_photos but no UPDATE
-- policy, which caused album move requests to affect zero rows under RLS.

DROP POLICY IF EXISTS "Users can update job photos for jobs they can access" ON public.job_photos;

CREATE POLICY "Users can update job photos for jobs they can access"
ON public.job_photos
FOR UPDATE
USING (
  public.user_can_access_job(auth.uid(), job_photos.job_id)
)
WITH CHECK (
  public.user_can_access_job(auth.uid(), job_photos.job_id)
  AND (
    job_photos.album_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.photo_albums pa
      WHERE pa.id = job_photos.album_id
        AND pa.job_id = job_photos.job_id
    )
  )
);
