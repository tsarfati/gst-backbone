
-- Add auto-logout and daily message columns to punch_clock_login_settings
ALTER TABLE public.punch_clock_login_settings
ADD COLUMN IF NOT EXISTS auto_logout_minutes integer DEFAULT NULL;

ALTER TABLE public.punch_clock_login_settings
ADD COLUMN IF NOT EXISTS daily_message_type text DEFAULT 'none';

-- Create daily_messages table for caching
CREATE TABLE public.daily_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  message_date date NOT NULL DEFAULT CURRENT_DATE,
  message_type text NOT NULL CHECK (message_type IN ('joke', 'riddle', 'quote')),
  question text NOT NULL,
  answer text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, message_date, message_type)
);

ALTER TABLE public.daily_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read daily messages"
ON public.daily_messages FOR SELECT
USING (true);

CREATE POLICY "Service role can insert daily messages"
ON public.daily_messages FOR INSERT
WITH CHECK (true);
