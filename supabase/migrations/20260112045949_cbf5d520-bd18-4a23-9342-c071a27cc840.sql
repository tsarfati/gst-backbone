-- Fix company theme not applying for non-admin users by allowing reads of company defaults (user_id IS NULL)
-- and allowing company admins/controllers to write company defaults.

-- Ensure RLS is enabled
ALTER TABLE public.company_ui_settings ENABLE ROW LEVEL SECURITY;

-- Drop old policies (if they exist)
DROP POLICY IF EXISTS "Users can view their own company UI settings" ON public.company_ui_settings;
DROP POLICY IF EXISTS "Users can create their own company UI settings" ON public.company_ui_settings;
DROP POLICY IF EXISTS "Users can update their own company UI settings" ON public.company_ui_settings;

-- SELECT: users can read their own settings AND company defaults (user_id is null) for companies they can access
CREATE POLICY "Users can view company UI settings"
ON public.company_ui_settings
FOR SELECT
TO authenticated
USING (
  company_id IN (
    SELECT uc.company_id
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
  )
  AND (
    user_id = auth.uid()
    OR user_id IS NULL
  )
);

-- INSERT: users can create their own settings; admins/controllers can create company defaults (user_id is null)
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
      AND EXISTS (
        SELECT 1
        FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
        WHERE uc.company_id = company_ui_settings.company_id
          AND uc.role IN ('admin', 'company_admin', 'controller')
      )
    )
  )
);

-- UPDATE: users can update their own settings; admins/controllers can update company defaults (user_id is null)
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
      AND EXISTS (
        SELECT 1
        FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
        WHERE uc.company_id = company_ui_settings.company_id
          AND uc.role IN ('admin', 'company_admin', 'controller')
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
      AND EXISTS (
        SELECT 1
        FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
        WHERE uc.company_id = company_ui_settings.company_id
          AND uc.role IN ('admin', 'company_admin', 'controller')
      )
    )
  )
);
