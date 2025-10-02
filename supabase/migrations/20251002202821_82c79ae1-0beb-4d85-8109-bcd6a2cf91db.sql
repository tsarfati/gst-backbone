-- Add distance warning settings to job punch clock settings
ALTER TABLE job_punch_clock_settings
ADD COLUMN IF NOT EXISTS max_distance_from_job_meters integer DEFAULT 500,
ADD COLUMN IF NOT EXISTS enable_distance_warning boolean DEFAULT true;

COMMENT ON COLUMN job_punch_clock_settings.max_distance_from_job_meters IS 'Maximum allowed distance from job site in meters before warning is shown';
COMMENT ON COLUMN job_punch_clock_settings.enable_distance_warning IS 'Enable distance warning on time cards';