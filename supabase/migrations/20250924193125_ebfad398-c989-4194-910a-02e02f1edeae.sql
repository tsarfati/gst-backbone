-- Add background image URL field to punch_clock_login_settings
ALTER TABLE public.punch_clock_login_settings 
ADD COLUMN background_image_url text;