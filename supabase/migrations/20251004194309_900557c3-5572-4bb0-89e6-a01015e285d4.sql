-- Add background_color column to visitor_login_settings table
ALTER TABLE visitor_login_settings 
ADD COLUMN IF NOT EXISTS background_color text DEFAULT '#3b82f6';