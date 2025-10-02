-- Add unique constraint to employee_timecard_settings to allow upserts
ALTER TABLE public.employee_timecard_settings 
ADD CONSTRAINT employee_timecard_settings_user_company_unique 
UNIQUE (user_id, company_id);