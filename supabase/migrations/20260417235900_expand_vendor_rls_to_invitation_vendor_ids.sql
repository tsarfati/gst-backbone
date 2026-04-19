CREATE OR REPLACE FUNCTION public.get_user_vendor_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH vendor_sources AS (
    SELECT p.vendor_id
    FROM public.profiles p
    WHERE p.user_id = _user_id
      AND p.vendor_id IS NOT NULL

    UNION

    SELECT vi.vendor_id
    FROM public.vendor_invitations vi
    WHERE vi.created_user_id = _user_id
      AND vi.vendor_id IS NOT NULL
  )
  SELECT COALESCE(array_agg(vendor_id), ARRAY[]::uuid[])
  FROM vendor_sources
$$;

CREATE OR REPLACE FUNCTION public.user_has_vendor_access(_user_id uuid, _vendor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_vendor_id = ANY(public.get_user_vendor_ids(_user_id)), false)
$$;

CREATE OR REPLACE FUNCTION public.get_user_vendor_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vendor_id
  FROM unnest(public.get_user_vendor_ids(_user_id)) AS vendor_id
  LIMIT 1
$$;

DROP POLICY IF EXISTS "Users can view invited vendors in their company" ON public.rfp_invited_vendors;
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
    AND public.user_has_vendor_access(auth.uid(), rfp_invited_vendors.vendor_id)
  )
);

DROP POLICY IF EXISTS "Vendors can view bids for invited RFPs" ON public.bids;
CREATE POLICY "Vendors can view bids for invited RFPs"
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
    AND public.user_has_vendor_access(auth.uid(), bids.vendor_id)
    AND EXISTS (
      SELECT 1
      FROM public.rfp_invited_vendors riv
      WHERE riv.rfp_id = bids.rfp_id
        AND public.user_has_vendor_access(auth.uid(), riv.vendor_id)
    )
  )
);

DROP POLICY IF EXISTS "Vendors can manage their own bids for invited RFPs" ON public.bids;
CREATE POLICY "Vendors can manage their own bids for invited RFPs"
ON public.bids FOR INSERT
WITH CHECK (
  public.is_vendor_user(auth.uid())
  AND public.user_has_vendor_access(auth.uid(), bids.vendor_id)
  AND EXISTS (
    SELECT 1
    FROM public.rfp_invited_vendors riv
    WHERE riv.rfp_id = bids.rfp_id
      AND public.user_has_vendor_access(auth.uid(), riv.vendor_id)
  )
);

DROP POLICY IF EXISTS "Vendors can update their own bids for invited RFPs" ON public.bids;
CREATE POLICY "Vendors can update their own bids for invited RFPs"
ON public.bids FOR UPDATE
USING (
  public.is_vendor_user(auth.uid())
  AND public.user_has_vendor_access(auth.uid(), bids.vendor_id)
  AND EXISTS (
    SELECT 1
    FROM public.rfp_invited_vendors riv
    WHERE riv.rfp_id = bids.rfp_id
      AND public.user_has_vendor_access(auth.uid(), riv.vendor_id)
  )
)
WITH CHECK (
  public.is_vendor_user(auth.uid())
  AND public.user_has_vendor_access(auth.uid(), bids.vendor_id)
  AND EXISTS (
    SELECT 1
    FROM public.rfp_invited_vendors riv
    WHERE riv.rfp_id = bids.rfp_id
      AND public.user_has_vendor_access(auth.uid(), riv.vendor_id)
  )
);
