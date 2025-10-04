-- Add text color setting for visitor login appearance
ALTER TABLE IF EXISTS public.visitor_login_settings
  ADD COLUMN IF NOT EXISTS text_color text;

-- Extend auto logout settings to support SMS on check-in with template
ALTER TABLE IF EXISTS public.visitor_auto_logout_settings
  ADD COLUMN IF NOT EXISTS send_sms_on_checkin boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS sms_message_template text DEFAULT 'Thanks for checking in at {{job_name}} on {{date_time}}. When you leave, tap here to check out: {{checkout_link}}';

-- Add checkout tracking fields to visitor logs
ALTER TABLE IF EXISTS public.visitor_logs
  ADD COLUMN IF NOT EXISTS checkout_token uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS checked_out_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_visitor_logs_checkout_token ON public.visitor_logs(checkout_token);
