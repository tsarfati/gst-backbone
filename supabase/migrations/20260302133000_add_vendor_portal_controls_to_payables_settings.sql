-- Vendor portal controls and default vendor job access settings
ALTER TABLE public.payables_settings
ADD COLUMN IF NOT EXISTS vendor_portal_enabled boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS vendor_portal_payment_changes_auto_approve boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS vendor_portal_require_job_assignment_for_bills boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS vendor_portal_default_job_access_billing boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS vendor_portal_default_job_access_team_directory boolean NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS vendor_portal_default_job_access_plans boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS vendor_portal_default_job_access_rfis boolean NOT NULL DEFAULT false;
