-- Add new columns needed by PunchClockSettingsComponent general save
ALTER TABLE public.job_punch_clock_settings
ADD COLUMN IF NOT EXISTS company_policies text,
ADD COLUMN IF NOT EXISTS overtime_past_window_threshold_minutes integer DEFAULT 30,
ADD COLUMN IF NOT EXISTS punch_rounding_direction text DEFAULT 'nearest';