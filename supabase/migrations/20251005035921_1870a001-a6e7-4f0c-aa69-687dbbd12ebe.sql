-- Add show_install_button column to job_punch_clock_settings table
ALTER TABLE job_punch_clock_settings 
ADD COLUMN IF NOT EXISTS show_install_button boolean DEFAULT true;