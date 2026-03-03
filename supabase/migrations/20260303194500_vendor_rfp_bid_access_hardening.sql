-- Vendor RFP/Bid access hardening:
-- Vendors/design professionals can only see invited RFPs + attachments,
-- can only create/update their own bids, and cannot see scoring.

-- RFPs
DROP POLICY IF EXISTS "Users can view rfps in their company" ON public.rfps;
DROP POLICY IF EXISTS "Users can create rfps in their company" ON public.rfps;
DROP POLICY IF EXISTS "Users can update rfps in their company" ON public.rfps;
DROP POLICY IF EXISTS "Users can delete rfps in their company" ON public.rfps;

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
        AND riv.vendor_id = public.get_user_vendor_id(auth.uid())
    )
  )
);

CREATE POLICY "Users can create rfps in their company"
ON public.rfps FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = rfps.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

CREATE POLICY "Users can update rfps in their company"
ON public.rfps FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = rfps.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

CREATE POLICY "Users can delete rfps in their company"
ON public.rfps FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = rfps.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

-- RFP attachments
DROP POLICY IF EXISTS "Users can view rfp attachments in their company" ON public.rfp_attachments;
DROP POLICY IF EXISTS "Users can manage rfp attachments in their company" ON public.rfp_attachments;

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
        AND riv.vendor_id = public.get_user_vendor_id(auth.uid())
    )
  )
);

CREATE POLICY "Users can manage rfp attachments in their company"
ON public.rfp_attachments FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = rfp_attachments.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = rfp_attachments.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

-- RFP invited vendors
DROP POLICY IF EXISTS "Users can view invited vendors in their company" ON public.rfp_invited_vendors;
DROP POLICY IF EXISTS "Users can manage invited vendors in their company" ON public.rfp_invited_vendors;

CREATE POLICY "Users can view invited vendors in their company"
ON public.rfp_invited_vendors FOR SELECT
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.user_company_access uca
      WHERE uca.user_id = auth.uid()
        AND uca.company_id = rfp_invited_vendors.company_id
        AND COALESCE(uca.is_active, true) = true
        AND uca.role::text NOT IN ('vendor', 'design_professional')
    )
  )
  OR
  (
    public.is_vendor_user(auth.uid())
    AND rfp_invited_vendors.vendor_id = public.get_user_vendor_id(auth.uid())
  )
);

CREATE POLICY "Users can manage invited vendors in their company"
ON public.rfp_invited_vendors FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = rfp_invited_vendors.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = rfp_invited_vendors.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

-- Bids
DROP POLICY IF EXISTS "Users can view bids in their company" ON public.bids;
DROP POLICY IF EXISTS "Users can create bids in their company" ON public.bids;
DROP POLICY IF EXISTS "Users can update bids in their company" ON public.bids;
DROP POLICY IF EXISTS "Users can delete bids in their company" ON public.bids;

CREATE POLICY "Users can view bids in their company"
ON public.bids FOR SELECT
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.user_company_access uca
      WHERE uca.user_id = auth.uid()
        AND uca.company_id = bids.company_id
        AND COALESCE(uca.is_active, true) = true
        AND uca.role::text NOT IN ('vendor', 'design_professional')
    )
  )
  OR
  (
    public.is_vendor_user(auth.uid())
    AND bids.vendor_id = public.get_user_vendor_id(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.rfp_invited_vendors riv
      WHERE riv.rfp_id = bids.rfp_id
        AND riv.company_id = bids.company_id
        AND riv.vendor_id = public.get_user_vendor_id(auth.uid())
    )
  )
);

CREATE POLICY "Users can create bids in their company"
ON public.bids FOR INSERT
WITH CHECK (
  (
    EXISTS (
      SELECT 1
      FROM public.user_company_access uca
      WHERE uca.user_id = auth.uid()
        AND uca.company_id = bids.company_id
        AND COALESCE(uca.is_active, true) = true
        AND uca.role::text NOT IN ('vendor', 'design_professional')
    )
  )
  OR
  (
    public.is_vendor_user(auth.uid())
    AND bids.vendor_id = public.get_user_vendor_id(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.rfp_invited_vendors riv
      WHERE riv.rfp_id = bids.rfp_id
        AND riv.company_id = bids.company_id
        AND riv.vendor_id = public.get_user_vendor_id(auth.uid())
    )
  )
);

CREATE POLICY "Users can update bids in their company"
ON public.bids FOR UPDATE
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.user_company_access uca
      WHERE uca.user_id = auth.uid()
        AND uca.company_id = bids.company_id
        AND COALESCE(uca.is_active, true) = true
        AND uca.role::text NOT IN ('vendor', 'design_professional')
    )
  )
  OR
  (
    public.is_vendor_user(auth.uid())
    AND bids.vendor_id = public.get_user_vendor_id(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.rfp_invited_vendors riv
      WHERE riv.rfp_id = bids.rfp_id
        AND riv.company_id = bids.company_id
        AND riv.vendor_id = public.get_user_vendor_id(auth.uid())
    )
  )
);

CREATE POLICY "Users can delete bids in their company"
ON public.bids FOR DELETE
USING (
  (
    EXISTS (
      SELECT 1
      FROM public.user_company_access uca
      WHERE uca.user_id = auth.uid()
        AND uca.company_id = bids.company_id
        AND COALESCE(uca.is_active, true) = true
        AND uca.role::text NOT IN ('vendor', 'design_professional')
    )
  )
  OR
  (
    public.is_vendor_user(auth.uid())
    AND bids.vendor_id = public.get_user_vendor_id(auth.uid())
  )
);

-- Scoring criteria and scores are company-internal only.
DROP POLICY IF EXISTS "Users can view scoring criteria in their company" ON public.bid_scoring_criteria;
DROP POLICY IF EXISTS "Users can manage scoring criteria in their company" ON public.bid_scoring_criteria;

CREATE POLICY "Users can view scoring criteria in their company"
ON public.bid_scoring_criteria FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = bid_scoring_criteria.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

CREATE POLICY "Users can manage scoring criteria in their company"
ON public.bid_scoring_criteria FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = bid_scoring_criteria.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = bid_scoring_criteria.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

DROP POLICY IF EXISTS "Users can view bid scores in their company" ON public.bid_scores;
DROP POLICY IF EXISTS "Users can manage bid scores in their company" ON public.bid_scores;

CREATE POLICY "Users can view bid scores in their company"
ON public.bid_scores FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = bid_scores.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

CREATE POLICY "Users can manage bid scores in their company"
ON public.bid_scores FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = bid_scores.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = bid_scores.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text NOT IN ('vendor', 'design_professional')
  )
);

