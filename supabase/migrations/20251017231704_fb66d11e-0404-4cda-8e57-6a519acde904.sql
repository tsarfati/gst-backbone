-- Add internal notes to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS internal_notes text;

-- Add PM approval fields to invoices table
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id);
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;

-- Add PM approval requirement setting to jobs table
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS require_pm_bill_approval boolean DEFAULT false;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_invoices_approved_by ON public.invoices(approved_by);
CREATE INDEX IF NOT EXISTS idx_jobs_require_pm_approval ON public.jobs(require_pm_bill_approval) WHERE require_pm_bill_approval = true;