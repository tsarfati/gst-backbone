ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vendor_portal_role text;

UPDATE public.profiles
SET vendor_portal_role = COALESCE(vendor_portal_role, 'owner')
WHERE role::text = 'vendor'
  AND vendor_id IS NOT NULL
  AND vendor_portal_role IS NULL
  AND (
    approved_by = user_id
    OR current_company_id IN (
      SELECT c.id
      FROM public.companies c
      WHERE c.created_by = profiles.user_id
        AND c.company_type = 'vendor'
    )
  );

UPDATE public.profiles
SET vendor_portal_role = COALESCE(vendor_portal_role, 'basic_user')
WHERE role::text = 'vendor'
  AND vendor_id IS NOT NULL
  AND vendor_portal_role IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_vendor_portal_role_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_vendor_portal_role_check
      CHECK (
        vendor_portal_role IS NULL
        OR vendor_portal_role IN (
          'owner',
          'admin',
          'accounting',
          'project_contact',
          'estimator',
          'compliance_manager',
          'basic_user'
        )
      );
  END IF;
END $$;
