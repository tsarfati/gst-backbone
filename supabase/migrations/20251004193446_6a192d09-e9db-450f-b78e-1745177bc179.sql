-- Add theme column to visitor_login_settings table
ALTER TABLE visitor_login_settings 
ADD COLUMN IF NOT EXISTS theme text NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark'));