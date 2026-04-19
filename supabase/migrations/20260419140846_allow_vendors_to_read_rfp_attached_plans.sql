-- Allow vendors to read plan metadata only for plans/pages explicitly attached
-- to an RFP that has been shared with them.

DROP POLICY IF EXISTS "Vendors can view RFP attached job plans" ON public.job_plans;
CREATE POLICY "Vendors can view RFP attached job plans"
ON public.job_plans
FOR SELECT
TO authenticated
USING (
  public.is_vendor_user(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.rfp_plan_pages rpp
    JOIN public.rfp_invited_vendors riv
      ON riv.rfp_id = rpp.rfp_id
     AND riv.company_id = rpp.company_id
    WHERE rpp.plan_id = job_plans.id
      AND public.user_has_vendor_access(auth.uid(), riv.vendor_id)
  )
);

DROP POLICY IF EXISTS "Vendors can view RFP attached plan pages" ON public.plan_pages;
CREATE POLICY "Vendors can view RFP attached plan pages"
ON public.plan_pages
FOR SELECT
TO authenticated
USING (
  public.is_vendor_user(auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.rfp_plan_pages rpp
    JOIN public.rfp_invited_vendors riv
      ON riv.rfp_id = rpp.rfp_id
     AND riv.company_id = rpp.company_id
    WHERE rpp.plan_page_id = plan_pages.id
      AND public.user_has_vendor_access(auth.uid(), riv.vendor_id)
  )
);
