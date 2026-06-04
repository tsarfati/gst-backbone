DROP POLICY IF EXISTS "Users can view SMS settings for their companies" ON public.company_sms_settings;
DROP POLICY IF EXISTS "Admins and controllers can manage SMS settings" ON public.company_sms_settings;

CREATE POLICY "Users can view SMS settings for their companies or super admin"
  ON public.company_sms_settings
  FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR company_id IN (
      SELECT uc.company_id
      FROM get_user_companies(auth.uid()) uc
    )
  );

CREATE POLICY "Admins controllers or super admin can manage SMS settings"
  ON public.company_sms_settings
  FOR ALL
  USING (
    public.is_super_admin(auth.uid())
    OR company_id IN (
      SELECT uc.company_id
      FROM get_user_companies(auth.uid()) uc
      WHERE uc.role IN ('admin', 'controller')
    )
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR company_id IN (
      SELECT uc.company_id
      FROM get_user_companies(auth.uid()) uc
      WHERE uc.role IN ('admin', 'controller')
    )
  );
