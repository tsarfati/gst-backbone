-- Vendor portal users can legitimately access subcontracts through invitation-
-- aware vendor membership even when their global profile role is not a pure
-- standalone vendor profile. Rely on user_has_vendor_access(...) here instead
-- of the older is_vendor_user(...) gate.

DROP POLICY IF EXISTS "Vendors can view subcontracts for assigned vendor jobs" ON public.subcontracts;

CREATE POLICY "Vendors can view subcontracts for assigned vendor jobs"
ON public.subcontracts
FOR SELECT
TO authenticated
USING (
  public.user_has_vendor_access(auth.uid(), subcontracts.vendor_id)
);
