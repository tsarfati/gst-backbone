-- Add checkout confirmation template fields to visitor_login_settings table
ALTER TABLE visitor_login_settings
ADD COLUMN IF NOT EXISTS checkout_title text DEFAULT 'Successfully Checked Out',
ADD COLUMN IF NOT EXISTS checkout_message text DEFAULT 'Thank you for visiting. Have a safe trip!',
ADD COLUMN IF NOT EXISTS checkout_show_duration boolean DEFAULT true;