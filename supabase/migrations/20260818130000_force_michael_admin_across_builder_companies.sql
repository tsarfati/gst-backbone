-- Ensure Michael Tsarfati has admin access across his BuilderLink companies.
-- This repairs company-level access rows when one workspace was accidentally
-- downgraded to employee while the primary profile still represents an admin.

DO $$
DECLARE
  v_user_id constant uuid := 'dcdfec98-5141-4559-adb2-fe1d70bfce98';
  v_greenstar_company_id constant uuid := 'dcdfec98-5141-4559-adb2-fe1d70bfce98';
BEGIN
  WITH target_companies AS (
    SELECT id
    FROM public.companies
    WHERE id = v_greenstar_company_id
       OR lower(coalesce(display_name, '')) IN (
         'higher limits development',
         'greenstarteam,llc',
         'gst, llc'
       )
       OR lower(name) IN (
         'higher limits development',
         'sigma construction',
         'greenstarteam,llc',
         'gst, llc'
       )
  )
  INSERT INTO public.user_company_access (
    user_id,
    company_id,
    role,
    is_active,
    granted_by,
    granted_at
  )
  SELECT
    v_user_id,
    tc.id,
    'admin'::public.user_role,
    true,
    v_user_id,
    now()
  FROM target_companies tc
  ON CONFLICT (user_id, company_id)
  DO UPDATE SET
    role = 'admin'::public.user_role,
    is_active = true,
    granted_by = EXCLUDED.granted_by,
    granted_at = EXCLUDED.granted_at;

  UPDATE public.profiles
  SET
    role = 'admin'::public.user_role,
    status = coalesce(status, 'approved'),
    has_global_job_access = true,
    default_company_id = coalesce(default_company_id, v_greenstar_company_id),
    updated_at = now()
  WHERE user_id = v_user_id;

  UPDATE auth.users
  SET
    raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'admin'),
    raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', 'admin')
  WHERE id = v_user_id;
END
$$;
