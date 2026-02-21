-- Add app_source column to track which app the login came from
ALTER TABLE public.user_login_audit 
ADD COLUMN IF NOT EXISTS app_source text DEFAULT 'builderlynk_web';

-- Add comment for documentation
COMMENT ON COLUMN public.user_login_audit.app_source IS 'Which app the login was from: builderlynk_web, punch_clock, pmlynk';
