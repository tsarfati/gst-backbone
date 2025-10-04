-- Public access for visitor-related resources
-- 1) Allow public read of jobs that have a visitor QR code
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='jobs' AND policyname='Public can view jobs with visitor QR') THEN
    CREATE POLICY "Public can view jobs with visitor QR" 
    ON public.jobs 
    FOR SELECT 
    USING (visitor_qr_code IS NOT NULL);
  END IF;
END $$;

-- 2) Allow public read of job_subcontractors for jobs that expose visitor QR codes
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_subcontractors' AND policyname='Public can view subcontractors for QR jobs') THEN
    CREATE POLICY "Public can view subcontractors for QR jobs" 
    ON public.job_subcontractors 
    FOR SELECT 
    USING (
      EXISTS (
        SELECT 1 FROM public.jobs j 
        WHERE j.id = job_subcontractors.job_id 
          AND j.visitor_qr_code IS NOT NULL
      )
    );
  END IF;
END $$;

-- 3) Ensure visitor_login_settings are viewable publicly (non-sensitive branding)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='visitor_login_settings' AND policyname='Anyone can view visitor login settings') THEN
    CREATE POLICY "Anyone can view visitor login settings"
    ON public.visitor_login_settings
    FOR SELECT
    USING (true);
  END IF;
END $$;