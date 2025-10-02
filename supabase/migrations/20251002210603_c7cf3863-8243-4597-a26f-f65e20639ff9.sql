-- Fix job_punch_clock_settings to allow null job_id for default settings
-- and add early punch in restriction fields

-- Make job_id nullable to support default/company-wide settings
ALTER TABLE public.job_punch_clock_settings 
ALTER COLUMN job_id DROP NOT NULL;

-- Add early punch in restriction columns
ALTER TABLE public.job_punch_clock_settings
ADD COLUMN IF NOT EXISTS allow_early_punch_in boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS scheduled_start_time time DEFAULT '08:00'::time,
ADD COLUMN IF NOT EXISTS early_punch_in_buffer_minutes integer DEFAULT 15;

-- Add comment to clarify nullable job_id
COMMENT ON COLUMN public.job_punch_clock_settings.job_id IS 'Job ID for job-specific settings. NULL indicates default/company-wide settings.';