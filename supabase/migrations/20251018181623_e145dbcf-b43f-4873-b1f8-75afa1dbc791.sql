-- Add SMS reminder settings to visitor_auto_logout_settings table
ALTER TABLE visitor_auto_logout_settings
ADD COLUMN IF NOT EXISTS sms_reminder_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sms_reminder_hours integer DEFAULT 4,
ADD COLUMN IF NOT EXISTS sms_reminder_message text DEFAULT 'You are still checked in at {{job_name}}. If you have left, please check out here: {{checkout_link}}';

-- Add SMS reminder settings to job_punch_clock_settings table  
ALTER TABLE job_punch_clock_settings
ADD COLUMN IF NOT EXISTS sms_punchout_reminder_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sms_punchout_reminder_minutes integer DEFAULT 30;