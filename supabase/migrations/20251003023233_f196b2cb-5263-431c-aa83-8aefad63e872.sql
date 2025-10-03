-- Add overtime_past_window_threshold_minutes to job_punch_clock_settings table
ALTER TABLE job_punch_clock_settings 
ADD COLUMN IF NOT EXISTS overtime_past_window_threshold_minutes integer DEFAULT 30;