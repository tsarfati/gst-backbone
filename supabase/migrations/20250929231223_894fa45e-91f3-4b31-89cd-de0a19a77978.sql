-- Soft delete support for jobs
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Helpful index for company + active filtering
CREATE INDEX IF NOT EXISTS idx_jobs_company_active ON public.jobs (company_id, is_active);
