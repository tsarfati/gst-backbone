-- Add require_timecard_change_approval column to job_punch_clock_settings table
ALTER TABLE public.job_punch_clock_settings
ADD COLUMN IF NOT EXISTS require_timecard_change_approval boolean DEFAULT false;