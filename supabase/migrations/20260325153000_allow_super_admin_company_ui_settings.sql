-- Allow shared company settings to be written by super admins and owners.
-- Without this, a super_admin can edit appearance in the UI but the write to the
-- company-level company_ui_settings row is rejected by RLS and silently reverts.

DROP POLICY IF EXISTS "Users can create company UI settings" ON public.company_ui_settings;
DROP POLICY IF EXISTS "Users can update company UI settings" ON public.company_ui_settings;

CREATE POLICY "Users can create company UI settings"
ON public.company_ui_settings
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT uc.company_id
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
  )
  AND (
    user_id = auth.uid()
    OR (
      user_id IS NULL
      AND (
        EXISTS (
          SELECT 1
          FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
          WHERE uc.company_id = company_ui_settings.company_id
            AND LOWER(COALESCE(uc.role::text, '')) IN ('super_admin', 'owner', 'admin', 'company_admin', 'controller')
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND LOWER(COALESCE(p.role::text, '')) = 'super_admin'
        )
      )
    )
  )
);

CREATE POLICY "Users can update company UI settings"
ON public.company_ui_settings
FOR UPDATE
TO authenticated
USING (
  company_id IN (
    SELECT uc.company_id
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
  )
  AND (
    user_id = auth.uid()
    OR (
      user_id IS NULL
      AND (
        EXISTS (
          SELECT 1
          FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
          WHERE uc.company_id = company_ui_settings.company_id
            AND LOWER(COALESCE(uc.role::text, '')) IN ('super_admin', 'owner', 'admin', 'company_admin', 'controller')
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND LOWER(COALESCE(p.role::text, '')) = 'super_admin'
        )
      )
    )
  )
)
WITH CHECK (
  company_id IN (
    SELECT uc.company_id
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
  )
  AND (
    user_id = auth.uid()
    OR (
      user_id IS NULL
      AND (
        EXISTS (
          SELECT 1
          FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
          WHERE uc.company_id = company_ui_settings.company_id
            AND LOWER(COALESCE(uc.role::text, '')) IN ('super_admin', 'owner', 'admin', 'company_admin', 'controller')
        )
        OR EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.user_id = auth.uid()
            AND LOWER(COALESCE(p.role::text, '')) = 'super_admin'
        )
      )
    )
  )
);
