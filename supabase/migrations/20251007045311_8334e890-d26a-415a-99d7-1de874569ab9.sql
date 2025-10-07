-- Add new punch clock settings fields for shift time management and time display format
ALTER TABLE public.job_punch_clock_settings 
ADD COLUMN IF NOT EXISTS time_display_format text DEFAULT 'hours_minutes',
ADD COLUMN IF NOT EXISTS shift_start_time time DEFAULT '07:00:00',
ADD COLUMN IF NOT EXISTS shift_end_time time DEFAULT '15:30:00',
ADD COLUMN IF NOT EXISTS shift_hours numeric DEFAULT 8,
ADD COLUMN IF NOT EXISTS overtime_grace_period_minutes integer DEFAULT 30;

-- Add comments for clarity
COMMENT ON COLUMN public.job_punch_clock_settings.time_display_format IS 'Format for displaying time: hours_minutes (e.g., 1h 15m) or decimal (e.g., 1.25)';
COMMENT ON COLUMN public.job_punch_clock_settings.shift_start_time IS 'Official shift start time (when hours begin counting)';
COMMENT ON COLUMN public.job_punch_clock_settings.shift_end_time IS 'Official shift end time';
COMMENT ON COLUMN public.job_punch_clock_settings.shift_hours IS 'Standard hours for a full shift (e.g., 8 hours)';
COMMENT ON COLUMN public.job_punch_clock_settings.overtime_grace_period_minutes IS 'Grace period before overtime starts (e.g., 30 minutes after shift end)';