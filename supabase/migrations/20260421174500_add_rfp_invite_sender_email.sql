ALTER TABLE public.rfp_invited_vendors
  ADD COLUMN IF NOT EXISTS email_from_address text;

COMMENT ON COLUMN public.rfp_invited_vendors.email_from_address IS
  'Actual sender email address used for the RFP invite.';
