-- Grant execute on validate_pin to anonymous and authenticated users
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_pin(text) TO anon, authenticated;

-- Make punch clock login settings readable anonymously if the table exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace 
    WHERE n.nspname = 'public' AND c.relname = 'punch_clock_login_settings'
  ) THEN
    ALTER TABLE public.punch_clock_login_settings ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname = 'public' 
        AND tablename = 'punch_clock_login_settings' 
        AND policyname = 'Anyone can view login settings'
    ) THEN
      CREATE POLICY "Anyone can view login settings"
      ON public.punch_clock_login_settings
      FOR SELECT
      USING (true);
    END IF;
  END IF;
END $$;