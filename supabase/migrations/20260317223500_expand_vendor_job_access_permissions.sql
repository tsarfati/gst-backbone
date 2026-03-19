ALTER TABLE public.vendor_job_access
  ADD COLUMN IF NOT EXISTS can_view_job_details boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_view_rfis boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_submittals boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_submit_submittals boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_photos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_rfps boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_submit_bids boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_view_subcontracts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_access_messages boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_vendor_job_access_core_permissions
  ON public.vendor_job_access(vendor_id, job_id, can_submit_bills, can_view_plans, can_view_rfis, can_view_submittals);
