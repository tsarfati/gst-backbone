-- Repair mixed BuilderLYNK/vendor state for mtsarfati@gmail.com.
-- Keep vendor portal access company-specific via vendor invitations,
-- but restore the primary BuilderLYNK identity and GreenStar admin access.

DO $$
DECLARE
  v_user_id uuid := 'dcdfec98-5141-4559-adb2-fe1d70bfce98';
  v_greenstar_company_id uuid := 'dcdfec98-5141-4559-adb2-fe1d70bfce98';
  v_sigma_company_id uuid := 'f64fff8d-16f4-4a07-81b3-e470d7e2d560';
BEGIN
  INSERT INTO public.user_company_access (
    user_id,
    company_id,
    role,
    is_active,
    granted_by,
    granted_at
  )
  VALUES (
    v_user_id,
    v_greenstar_company_id,
    'admin'::public.user_role,
    true,
    v_user_id,
    now()
  )
  ON CONFLICT (user_id, company_id)
  DO UPDATE SET
    role = 'admin'::public.user_role,
    is_active = true,
    granted_by = EXCLUDED.granted_by,
    granted_at = EXCLUDED.granted_at;

  UPDATE public.profiles
  SET
    role = 'admin'::public.user_role,
    current_company_id = COALESCE(current_company_id, v_sigma_company_id),
    default_company_id = v_greenstar_company_id,
    vendor_id = NULL,
    vendor_portal_role = NULL,
    updated_at = now()
  WHERE user_id = v_user_id;

  UPDATE auth.users
  SET
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'role', 'admin',
        'current_company_id', COALESCE((SELECT current_company_id FROM public.profiles WHERE user_id = v_user_id), v_sigma_company_id),
        'default_company_id', v_greenstar_company_id,
        'is_vendor', false,
        'vendor_id', NULL,
        'vendor_portal_role', NULL
      ),
    raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object(
        'role', 'admin',
        'current_company_id', COALESCE((SELECT current_company_id FROM public.profiles WHERE user_id = v_user_id), v_sigma_company_id),
        'default_company_id', v_greenstar_company_id,
        'is_vendor', false,
        'vendor_id', NULL,
        'vendor_portal_role', NULL
      )
  WHERE id = v_user_id;
END
$$;
