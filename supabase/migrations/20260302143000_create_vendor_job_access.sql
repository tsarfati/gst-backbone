-- Vendor-to-job assignment with per-job access controls
CREATE TABLE IF NOT EXISTS public.vendor_job_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  can_submit_bills boolean NOT NULL DEFAULT true,
  can_view_plans boolean NOT NULL DEFAULT false,
  can_submit_rfis boolean NOT NULL DEFAULT false,
  can_view_team_directory boolean NOT NULL DEFAULT true,
  can_upload_compliance_docs boolean NOT NULL DEFAULT true,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_id, job_id)
);

ALTER TABLE public.vendor_job_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view vendor job access for their companies" ON public.vendor_job_access;
CREATE POLICY "Users can view vendor job access for their companies"
ON public.vendor_job_access
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    JOIN public.get_user_companies(auth.uid()) uc ON uc.company_id = v.company_id
    WHERE v.id = vendor_job_access.vendor_id
  )
);

DROP POLICY IF EXISTS "Users can insert vendor job access for their companies" ON public.vendor_job_access;
CREATE POLICY "Users can insert vendor job access for their companies"
ON public.vendor_job_access
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    JOIN public.get_user_companies(auth.uid()) uc ON uc.company_id = v.company_id
    WHERE v.id = vendor_job_access.vendor_id
  )
);

DROP POLICY IF EXISTS "Users can update vendor job access for their companies" ON public.vendor_job_access;
CREATE POLICY "Users can update vendor job access for their companies"
ON public.vendor_job_access
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    JOIN public.get_user_companies(auth.uid()) uc ON uc.company_id = v.company_id
    WHERE v.id = vendor_job_access.vendor_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    JOIN public.get_user_companies(auth.uid()) uc ON uc.company_id = v.company_id
    WHERE v.id = vendor_job_access.vendor_id
  )
);

DROP POLICY IF EXISTS "Users can delete vendor job access for their companies" ON public.vendor_job_access;
CREATE POLICY "Users can delete vendor job access for their companies"
ON public.vendor_job_access
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    JOIN public.get_user_companies(auth.uid()) uc ON uc.company_id = v.company_id
    WHERE v.id = vendor_job_access.vendor_id
  )
);

DROP TRIGGER IF EXISTS update_vendor_job_access_updated_at ON public.vendor_job_access;
CREATE TRIGGER update_vendor_job_access_updated_at
BEFORE UPDATE ON public.vendor_job_access
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_vendor_job_access_vendor_id ON public.vendor_job_access(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_job_access_job_id ON public.vendor_job_access(job_id);
