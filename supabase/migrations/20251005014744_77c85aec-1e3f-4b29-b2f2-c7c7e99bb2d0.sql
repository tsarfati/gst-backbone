-- Add require_photo column to visitor_login_settings table
ALTER TABLE visitor_login_settings
ADD COLUMN IF NOT EXISTS require_photo boolean DEFAULT false;