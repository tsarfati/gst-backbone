ALTER TABLE public.rfp_invited_vendors
  ADD COLUMN IF NOT EXISTS resend_message_id text,
  ADD COLUMN IF NOT EXISTS email_status text,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_rfp_invited_vendors_resend_message_id
  ON public.rfp_invited_vendors(resend_message_id)
  WHERE resend_message_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mark_vendor_rfps_viewed(p_rfp_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor_id uuid;
BEGIN
  v_vendor_id := public.get_user_vendor_id(auth.uid());

  IF v_vendor_id IS NULL THEN
    RAISE EXCEPTION 'Vendor access required';
  END IF;

  UPDATE public.rfp_invited_vendors
  SET last_viewed_at = now()
  WHERE vendor_id = v_vendor_id
    AND rfp_id = ANY(COALESCE(p_rfp_ids, ARRAY[]::uuid[]));
END;
$$;

REVOKE ALL ON FUNCTION public.mark_vendor_rfps_viewed(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_vendor_rfps_viewed(uuid[]) TO authenticated;
