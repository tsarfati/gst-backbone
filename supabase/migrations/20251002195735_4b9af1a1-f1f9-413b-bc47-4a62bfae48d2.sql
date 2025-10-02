-- Add manual_photo_capture column to job_punch_clock_settings table
ALTER TABLE job_punch_clock_settings 
ADD COLUMN IF NOT EXISTS manual_photo_capture boolean DEFAULT true;

COMMENT ON COLUMN job_punch_clock_settings.manual_photo_capture IS 'If true, user must manually click to capture photo. If false, photo is auto-captured when face is detected.';