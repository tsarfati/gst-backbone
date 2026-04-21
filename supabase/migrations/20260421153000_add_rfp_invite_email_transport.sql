ALTER TABLE public.rfp_invited_vendors
  ADD COLUMN IF NOT EXISTS email_transport text;

COMMENT ON COLUMN public.rfp_invited_vendors.email_transport IS
  'Which mail transport sent the RFP invite: user_smtp, company_smtp, or builderlynk_resend.';
