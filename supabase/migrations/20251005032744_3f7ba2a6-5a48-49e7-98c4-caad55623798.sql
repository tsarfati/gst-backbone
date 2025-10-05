-- Add PWA icon settings to job_punch_clock_settings table
ALTER TABLE public.job_punch_clock_settings
  ADD COLUMN IF NOT EXISTS pwa_icon_192_url text,
  ADD COLUMN IF NOT EXISTS pwa_icon_512_url text,
  ADD COLUMN IF NOT EXISTS enable_install_prompt boolean DEFAULT true;