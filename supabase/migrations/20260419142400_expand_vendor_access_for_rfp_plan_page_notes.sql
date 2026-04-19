-- Align vendor note visibility with the broader vendor-access model used by
-- the rest of the RFP portal. Some vendor users can access invitations through
-- user_has_vendor_access(...) even when get_user_vendor_id(...) does not match
-- directly, which caused attached plan pages to load but their annotations to
-- remain hidden.

DROP POLICY IF EXISTS "Users can view rfp plan page notes in their company" ON public.rfp_plan_page_notes;

CREATE POLICY "Users can view rfp plan page notes in their company"
ON public.rfp_plan_page_notes
FOR SELECT
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.user_company_access uca
      WHERE uca.user_id = auth.uid()
        AND uca.company_id = rfp_plan_page_notes.company_id
        AND COALESCE(uca.is_active, true) = true
        AND uca.role::text NOT IN ('vendor', 'design_professional')
    )
  )
  OR
  (
    public.is_vendor_user(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.rfp_plan_pages rpp
      JOIN public.rfp_invited_vendors riv
        ON riv.rfp_id = rpp.rfp_id
       AND riv.company_id = rpp.company_id
      WHERE rpp.id = rfp_plan_page_notes.rfp_plan_page_id
        AND public.user_has_vendor_access(auth.uid(), riv.vendor_id)
    )
  )
);
