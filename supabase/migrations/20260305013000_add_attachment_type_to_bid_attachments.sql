ALTER TABLE public.bid_attachments
ADD COLUMN IF NOT EXISTS attachment_type TEXT NOT NULL DEFAULT 'quote';

CREATE INDEX IF NOT EXISTS idx_bid_attachments_attachment_type
  ON public.bid_attachments (attachment_type);


whsec_EClDW08MQKeH7Ed3+bDe/ky9XfdQDyPT


supabase secrets set BID_EMAIL_WEBHOOK_SECRET=whsec_8IbYhuuHnrh8GMEJ/06EO2QQKrzi1xqm

supabase secrets set BID_EMAIL_INBOUND_DOMAIN=<builderlynk.com>
supabase functions deploy get-bid-email-channel
supabase functions deploy send-bid-email






cd /Users/michael/gst-backbone-work

supabase secrets set RESEND_WEBHOOK_SIGNING_SECRET='PASTE_THE_EXACT_RESEND_WEBHOOK_SIGNING_SECRET'
supabase secrets set BID_EMAIL_WEBHOOK_SECRET='whsec_EClDW08MQKeH7Ed3+bDe/ky9XfdQDyPT'
supabase secrets set RESEND_API_KEY='re_18fQeMeo_GTpmxAWpmn2ien2aGuJ32ygW'

supabase functions deploy receive-bid-email-webhook
