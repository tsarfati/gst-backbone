-- Provide a safe fallback for loading company theme defaults for all company members.
-- This avoids RLS edge-cases where non-settings users cannot read company_ui_settings rows.

CREATE OR REPLACE FUNCTION public.get_company_theme_defaults(_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL OR _company_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Only allow members of the target company.
  IF NOT EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.company_id = _company_id
      AND uca.user_id = v_user_id
      AND COALESCE(uca.is_active, true) = true
  ) THEN
    RETURN NULL;
  END IF;

  -- Prefer explicit company defaults (user_id IS NULL).
  SELECT cus.settings::jsonb
  INTO v_result
  FROM public.company_ui_settings cus
  WHERE cus.company_id = _company_id
    AND cus.user_id IS NULL
  ORDER BY cus.updated_at DESC NULLS LAST, cus.created_at DESC NULLS LAST
  LIMIT 1;

  IF v_result IS NOT NULL THEN
    RETURN v_result;
  END IF;

  -- Fallback to latest admin/controller/company_admin row with custom colors.
  SELECT cus.settings::jsonb
  INTO v_result
  FROM public.company_ui_settings cus
  JOIN public.user_company_access uca
    ON uca.company_id = cus.company_id
   AND uca.user_id = cus.user_id
   AND COALESCE(uca.is_active, true) = true
  WHERE cus.company_id = _company_id
    AND cus.user_id IS NOT NULL
    AND LOWER(COALESCE(uca.role::text, '')) IN ('admin', 'company_admin', 'controller')
    AND (cus.settings::jsonb ? 'customColors')
  ORDER BY cus.updated_at DESC NULLS LAST, cus.created_at DESC NULLS LAST
  LIMIT 1;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_company_theme_defaults(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_company_theme_defaults(uuid) TO authenticated;

