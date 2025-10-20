-- Fix foreign key constraint on employee_timecard_settings to reference profiles instead of auth.users
ALTER TABLE employee_timecard_settings 
DROP CONSTRAINT IF EXISTS employee_timecard_settings_user_id_fkey;

-- Add foreign key to profiles table instead
ALTER TABLE employee_timecard_settings
ADD CONSTRAINT employee_timecard_settings_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES profiles(user_id) 
ON DELETE CASCADE;