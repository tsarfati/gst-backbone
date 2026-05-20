-- Align vendor portal access for subcontracts and job photo surfaces with the
-- invitation-aware vendor access model used elsewhere in the portal.

-- ---------------------------------------------------------------------------
-- Subcontracts
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Vendors can view their own subcontracts" ON public.subcontracts;
DROP POLICY IF EXISTS "Vendors can view subcontracts for assigned vendor jobs" ON public.subcontracts;

CREATE POLICY "Vendors can view subcontracts for assigned vendor jobs"
ON public.subcontracts
FOR SELECT
TO authenticated
USING (
  public.is_vendor_user(auth.uid())
  AND public.user_has_vendor_access(auth.uid(), subcontracts.vendor_id)
);

-- ---------------------------------------------------------------------------
-- Job Photos
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Vendors can view job photos for assigned vendor jobs" ON public.job_photos;

CREATE POLICY "Vendors can view job photos for assigned vendor jobs"
ON public.job_photos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.vendor_job_access vja
    WHERE vja.job_id = job_photos.job_id
      AND vja.can_view_photos = true
      AND public.user_has_vendor_access(auth.uid(), vja.vendor_id)
  )
);

-- ---------------------------------------------------------------------------
-- Photo Albums
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Vendors can view photo albums for assigned vendor jobs" ON public.photo_albums;

CREATE POLICY "Vendors can view photo albums for assigned vendor jobs"
ON public.photo_albums
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.vendor_job_access vja
    WHERE vja.job_id = photo_albums.job_id
      AND vja.can_view_photos = true
      AND public.user_has_vendor_access(auth.uid(), vja.vendor_id)
  )
);

-- ---------------------------------------------------------------------------
-- Photo Comments
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Vendors can view photo comments for assigned vendor jobs" ON public.photo_comments;

CREATE POLICY "Vendors can view photo comments for assigned vendor jobs"
ON public.photo_comments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.job_photos jp
    JOIN public.vendor_job_access vja
      ON vja.job_id = jp.job_id
    WHERE jp.id = photo_comments.photo_id
      AND vja.can_view_photos = true
      AND public.user_has_vendor_access(auth.uid(), vja.vendor_id)
  )
);
