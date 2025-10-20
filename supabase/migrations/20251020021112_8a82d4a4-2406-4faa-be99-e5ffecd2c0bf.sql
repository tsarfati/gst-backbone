-- Allow PIN employees to have timecard settings by removing restrictive FK to profiles
ALTER TABLE public.employee_timecard_settings 
DROP CONSTRAINT IF EXISTS employee_timecard_settings_user_id_fkey;

-- Optional: keep a performant lookup on user_id
CREATE INDEX IF NOT EXISTS idx_employee_timecard_settings_user_id ON public.employee_timecard_settings(user_id);