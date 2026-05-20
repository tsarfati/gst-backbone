DROP POLICY IF EXISTS "Vendors can view job-level RFPs for assigned vendor jobs" ON public.rfps;
CREATE POLICY "Vendors can view job-level RFPs for assigned vendor jobs"
ON public.rfps
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.vendor_job_access vja
    WHERE vja.job_id = rfps.job_id
      AND vja.can_view_rfps = true
      AND public.user_has_vendor_access(auth.uid(), vja.vendor_id)
  )
);

DROP POLICY IF EXISTS "Vendors can view RFP attachments for assigned vendor jobs" ON public.rfp_attachments;
CREATE POLICY "Vendors can view RFP attachments for assigned vendor jobs"
ON public.rfp_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.rfps r
    JOIN public.vendor_job_access vja
      ON vja.job_id = r.job_id
    WHERE r.id = rfp_attachments.rfp_id
      AND vja.can_view_rfps = true
      AND public.user_has_vendor_access(auth.uid(), vja.vendor_id)
  )
);

DROP POLICY IF EXISTS "Vendors can view RFP plan pages for assigned vendor jobs" ON public.rfp_plan_pages;
CREATE POLICY "Vendors can view RFP plan pages for assigned vendor jobs"
ON public.rfp_plan_pages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.rfps r
    JOIN public.vendor_job_access vja
      ON vja.job_id = r.job_id
    WHERE r.id = rfp_plan_pages.rfp_id
      AND vja.can_view_rfps = true
      AND public.user_has_vendor_access(auth.uid(), vja.vendor_id)
  )
);

DROP POLICY IF EXISTS "Vendors can view RFP plan page notes for assigned vendor jobs" ON public.rfp_plan_page_notes;
CREATE POLICY "Vendors can view RFP plan page notes for assigned vendor jobs"
ON public.rfp_plan_page_notes
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.rfp_plan_pages rpp
    JOIN public.rfps r
      ON r.id = rpp.rfp_id
    JOIN public.vendor_job_access vja
      ON vja.job_id = r.job_id
    WHERE rpp.id = rfp_plan_page_notes.rfp_plan_page_id
      AND vja.can_view_rfps = true
      AND public.user_has_vendor_access(auth.uid(), vja.vendor_id)
  )
);

DROP POLICY IF EXISTS "Vendors can view job-level subcontracts for assigned vendor jobs" ON public.subcontracts;
CREATE POLICY "Vendors can view job-level subcontracts for assigned vendor jobs"
ON public.subcontracts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.vendor_job_access vja
    WHERE vja.job_id = subcontracts.job_id
      AND vja.can_view_subcontracts = true
      AND public.user_has_vendor_access(auth.uid(), vja.vendor_id)
  )
);
