ALTER TABLE public.job_punch_clock_settings
ADD COLUMN IF NOT EXISTS disable_auto_approve_over_hours numeric DEFAULT NULL;