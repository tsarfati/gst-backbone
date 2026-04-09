ALTER TABLE public.design_professional_job_invites
  ADD COLUMN IF NOT EXISTS email_status text,
  ADD COLUMN IF NOT EXISTS email_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS email_bounced_at timestamptz,
  ADD COLUMN IF NOT EXISTS resend_message_id text;

CREATE INDEX IF NOT EXISTS idx_dp_job_invites_resend_message_id
  ON public.design_professional_job_invites(resend_message_id);
