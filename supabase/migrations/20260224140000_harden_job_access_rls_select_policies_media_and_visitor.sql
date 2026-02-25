-- Final read-policy hardening pass for job media and visitor logs.
-- Depends on helper functions from:
--   20260224133000_harden_job_access_rls_select_policies.sql
--
-- Scope (SELECT only):
--   - public.job_photos
--   - public.photo_albums
--   - public.photo_comments
--   - public.visitor_logs

-- ---------------------------------------------------------------------------
-- Job Photos
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view photos" ON public.job_photos;
DROP POLICY IF EXISTS "Users can view photos" ON public.job_photos;
DROP POLICY IF EXISTS "Users can view job photos for their company" ON public.job_photos;
DROP POLICY IF EXISTS "Tenant members can view job photos" ON public.job_photos;
DROP POLICY IF EXISTS "Company members can view job photos" ON public.job_photos;

CREATE POLICY "Tenant members can view job photos"
ON public.job_photos
FOR SELECT
USING (
  public.user_can_access_job(auth.uid(), job_photos.job_id)
);

-- ---------------------------------------------------------------------------
-- Photo Albums
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view photo albums for jobs they have access to" ON public.photo_albums;
DROP POLICY IF EXISTS "Users can view photo albums for their company" ON public.photo_albums;
DROP POLICY IF EXISTS "Tenant members can view photo albums" ON public.photo_albums;
DROP POLICY IF EXISTS "Company members can view photo albums" ON public.photo_albums;

CREATE POLICY "Tenant members can view photo albums"
ON public.photo_albums
FOR SELECT
USING (
  public.user_can_access_job(auth.uid(), photo_albums.job_id)
);

-- ---------------------------------------------------------------------------
-- Photo Comments (inherit access from photo -> job)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view photo comments for photos they have access to" ON public.photo_comments;
DROP POLICY IF EXISTS "Company members can view photo comments" ON public.photo_comments;

CREATE POLICY "Users can view photo comments for photos they have access to"
ON public.photo_comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.job_photos jp
    WHERE jp.id = photo_comments.photo_id
      AND public.user_can_access_job(auth.uid(), jp.job_id)
  )
);

-- ---------------------------------------------------------------------------
-- Visitor Logs
-- Keep public checkout-token reads intact while restricting authenticated reads.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view visitor logs" ON public.visitor_logs;
DROP POLICY IF EXISTS "Users can view visitor logs" ON public.visitor_logs;
DROP POLICY IF EXISTS "Users can view visitor logs for their companies" ON public.visitor_logs;
DROP POLICY IF EXISTS "Tenant members can view visitor logs" ON public.visitor_logs;

CREATE POLICY "Tenant members can view visitor logs"
ON public.visitor_logs
FOR SELECT
USING (
  checkout_token IS NOT NULL
  OR public.user_can_access_job(auth.uid(), visitor_logs.job_id)
);
