-- Add company membership-based SELECT policy for profiles so employee names/avatars show on dashboards
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Company members can view profiles via membership'
  ) THEN
    CREATE POLICY "Company members can view profiles via membership"
    ON public.profiles
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.user_company_access uca
        WHERE uca.user_id = profiles.user_id
          AND uca.is_active = true
          AND uca.company_id IN (
            SELECT uc.company_id FROM public.get_user_companies(auth.uid()) AS uc(company_id, company_name, role)
          )
      )
    );
  END IF;
END $$;