DROP POLICY IF EXISTS "Users can view rfps in their company" ON public.rfps;
CREATE POLICY "Users can view rfps in their company"
ON public.rfps FOR SELECT
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.user_company_access uca
      WHERE uca.user_id = auth.uid()
        AND uca.company_id = rfps.company_id
        AND COALESCE(uca.is_active, true) = true
        AND uca.role::text NOT IN ('vendor', 'design_professional')
    )
  )
  OR
  (
    public.is_vendor_user(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.rfp_invited_vendors riv
      WHERE riv.rfp_id = rfps.id
        AND riv.company_id = rfps.company_id
        AND public.user_has_vendor_access(auth.uid(), riv.vendor_id)
    )
  )
);

DROP POLICY IF EXISTS "Users can view rfp attachments in their company" ON public.rfp_attachments;
CREATE POLICY "Users can view rfp attachments in their company"
ON public.rfp_attachments FOR SELECT
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.user_company_access uca
      WHERE uca.user_id = auth.uid()
        AND uca.company_id = rfp_attachments.company_id
        AND COALESCE(uca.is_active, true) = true
        AND uca.role::text NOT IN ('vendor', 'design_professional')
    )
  )
  OR
  (
    public.is_vendor_user(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.rfp_invited_vendors riv
      WHERE riv.rfp_id = rfp_attachments.rfp_id
        AND riv.company_id = rfp_attachments.company_id
        AND public.user_has_vendor_access(auth.uid(), riv.vendor_id)
    )
  )
);

DROP POLICY IF EXISTS "Vendors can view jobs they are associated with" ON public.jobs;
CREATE POLICY "Vendors can view jobs they are associated with"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  public.is_vendor_user(auth.uid())
  AND (
    EXISTS (
      SELECT 1 FROM public.invoices
      WHERE invoices.job_id = jobs.id
        AND public.user_has_vendor_access(auth.uid(), invoices.vendor_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.subcontracts
      WHERE subcontracts.job_id = jobs.id
        AND public.user_has_vendor_access(auth.uid(), subcontracts.vendor_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.rfp_invited_vendors riv
      JOIN public.rfps r ON r.id = riv.rfp_id
      WHERE r.job_id = jobs.id
        AND public.user_has_vendor_access(auth.uid(), riv.vendor_id)
    )
  )
);
