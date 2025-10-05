-- Make job_id nullable in job_punch_clock_settings to allow company-wide settings
ALTER TABLE job_punch_clock_settings 
ALTER COLUMN job_id DROP NOT NULL;

-- Add a check to ensure either job_id is set OR it's a company-wide setting
-- This ensures we don't have orphaned records
ALTER TABLE job_punch_clock_settings 
ADD CONSTRAINT job_or_company_setting 
CHECK (job_id IS NOT NULL OR company_id IS NOT NULL);