-- Ensure company-wide theme defaults are readable by all company users and
-- backfill missing company default rows from existing user-level theme settings.

ALTER TABLE public.company_ui_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Some environments still had user_id as NOT NULL, which blocks company defaults (user_id IS NULL).
  ALTER TABLE public.company_ui_settings ALTER COLUMN user_id DROP NOT NULL;
EXCEPTION
  WHEN others THEN
    -- Safe no-op if already nullable or restricted.
    NULL;
END $$;

-- Recreate policies with company-default read support.
DROP POLICY IF EXISTS "Users can view company UI settings" ON public.company_ui_settings;
DROP POLICY IF EXISTS "Users can create company UI settings" ON public.company_ui_settings;
DROP POLICY IF EXISTS "Users can update company UI settings" ON public.company_ui_settings;
DROP POLICY IF EXISTS "Users can view their own company UI settings" ON public.company_ui_settings;
DROP POLICY IF EXISTS "Users can create their own company UI settings" ON public.company_ui_settings;
DROP POLICY IF EXISTS "Users can update their own company UI settings" ON public.company_ui_settings;

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

-- Backfill missing company default theme rows from latest active admin/company_admin/controller settings.
WITH latest_admin_theme AS (
  SELECT DISTINCT ON (cus.company_id)
    cus.company_id,
    (cus.settings::jsonb -> 'customColors') AS custom_colors
  FROM public.company_ui_settings cus
  JOIN public.user_company_access uca
    ON uca.company_id = cus.company_id
   AND uca.user_id = cus.user_id
   AND COALESCE(uca.is_active, true) = true
  WHERE cus.user_id IS NOT NULL
    AND (cus.settings::jsonb ? 'customColors')
    AND LOWER(COALESCE(uca.role::text, '')) IN ('admin', 'company_admin', 'controller')
  ORDER BY cus.company_id, cus.updated_at DESC NULLS LAST, cus.created_at DESC NULLS LAST
)
INSERT INTO public.company_ui_settings (company_id, user_id, settings)
SELECT
  lat.company_id,
  NULL,
  jsonb_build_object('customColors', lat.custom_colors)::jsonb
FROM latest_admin_theme lat
WHERE lat.custom_colors IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.company_ui_settings existing
    WHERE existing.company_id = lat.company_id
      AND existing.user_id IS NULL
  );
