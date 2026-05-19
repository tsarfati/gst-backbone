ALTER TABLE public.vendor_invitations
  ADD COLUMN IF NOT EXISTS vendor_portal_role text;

UPDATE public.vendor_invitations
SET vendor_portal_role = COALESCE(vendor_portal_role, 'basic_user')
WHERE vendor_portal_role IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vendor_invitations_vendor_portal_role_check'
      AND conrelid = 'public.vendor_invitations'::regclass
  ) THEN
    ALTER TABLE public.vendor_invitations
      ADD CONSTRAINT vendor_invitations_vendor_portal_role_check
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
