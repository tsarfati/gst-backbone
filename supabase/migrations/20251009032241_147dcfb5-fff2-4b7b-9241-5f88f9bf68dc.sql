-- Enable RLS and add safe policies for profiles and visitor_logs to fix data visibility and allow kiosk check-ins

-- PROFILES: enable RLS and allow viewing within same company and own profile
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Company users can view profiles in their companies'
  ) THEN
    CREATE POLICY "Company users can view profiles in their companies"
    ON public.profiles
    FOR SELECT
    USING (
      current_company_id IN (
        SELECT uc.company_id 
        FROM public.get_user_companies(auth.uid()) AS uc(company_id, company_name, role)
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can view their own profile'
  ) THEN
    CREATE POLICY "Users can view their own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- VISITOR LOGS: enable RLS and allow public inserts, restrict reads to company users
ALTER TABLE IF EXISTS public.visitor_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'visitor_logs' AND policyname = 'Anyone can create visitor logs'
  ) THEN
    CREATE POLICY "Anyone can create visitor logs"
    ON public.visitor_logs
    FOR INSERT
    WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'visitor_logs' AND policyname = 'Company users can view visitor logs for their companies'
  ) THEN
    CREATE POLICY "Company users can view visitor logs for their companies"
    ON public.visitor_logs
    FOR SELECT
    USING (
      company_id IN (
        SELECT uc.company_id 
        FROM public.get_user_companies(auth.uid()) AS uc(company_id, company_name, role)
      )
    );
  END IF;
END $$;