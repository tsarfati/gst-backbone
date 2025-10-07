-- Add settings for early/late paid time handling
ALTER TABLE public.job_punch_clock_settings 
ADD COLUMN IF NOT EXISTS count_early_punch_time boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS count_late_punch_in boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS late_grace_period_minutes integer DEFAULT 5;

COMMENT ON COLUMN public.job_punch_clock_settings.count_early_punch_time IS 'If true, time before shift start counts as paid time';
COMMENT ON COLUMN public.job_punch_clock_settings.count_late_punch_in IS 'If true, late punch-ins count as paid from actual punch time';
COMMENT ON COLUMN public.job_punch_clock_settings.late_grace_period_minutes IS 'Grace period for late arrivals before considered unpaid/penalized';