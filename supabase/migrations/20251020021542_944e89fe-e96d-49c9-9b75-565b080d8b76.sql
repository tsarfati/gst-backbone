-- Add flag columns for timecard hour warnings
ALTER TABLE public.job_punch_clock_settings
ADD COLUMN IF NOT EXISTS flag_timecards_over_12hrs BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS flag_timecards_over_24hrs BOOLEAN DEFAULT true;