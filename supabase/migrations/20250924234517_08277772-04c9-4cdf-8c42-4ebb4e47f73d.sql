-- Add bottom text field to punch clock login settings
ALTER TABLE public.punch_clock_login_settings 
ADD COLUMN bottom_text TEXT DEFAULT NULL;