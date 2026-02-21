-- Add app-specific access columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS punch_clock_access boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS pm_lynk_access boolean DEFAULT false;

COMMENT ON COLUMN public.profiles.punch_clock_access IS 'Whether this user PIN works for the Punch Clock app';
COMMENT ON COLUMN public.profiles.pm_lynk_access IS 'Whether this user PIN works for the PM Lynk app';
