ALTER TABLE public.user_email_settings
ADD COLUMN IF NOT EXISTS email_signature TEXT DEFAULT '';