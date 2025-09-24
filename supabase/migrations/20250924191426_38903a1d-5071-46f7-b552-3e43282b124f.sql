-- Make punch_clock_login_settings publicly readable for the unauthenticated login page
DO $$
BEGIN
  -- Drop the existing restrictive SELECT policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'punch_clock_login_settings' 
      AND policyname = 'All users can view punch clock login settings'
  ) THEN
    DROP POLICY "All users can view punch clock login settings" ON public.punch_clock_login_settings;
  END IF;

  -- Create a permissive policy allowing public read
  CREATE POLICY "Punch clock login settings are publicly readable"
  ON public.punch_clock_login_settings
  FOR SELECT
  USING (true);
END $$;