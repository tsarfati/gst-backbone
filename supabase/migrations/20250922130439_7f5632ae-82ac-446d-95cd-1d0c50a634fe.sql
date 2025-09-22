-- Add new fields to profiles table for complete user information
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS nickname TEXT,
ADD COLUMN IF NOT EXISTS birthday DATE,
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMP WITH TIME ZONE;

-- Update the handle_new_user function to set profile_completed to false initially
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert into profiles with profile_completed set to false
  INSERT INTO public.profiles (
    user_id, 
    first_name, 
    last_name, 
    display_name, 
    role,
    profile_completed
  )
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    'employee',
    false
  );
  
  -- Insert default dashboard settings
  INSERT INTO public.dashboard_settings (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;