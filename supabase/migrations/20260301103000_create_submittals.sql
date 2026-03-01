-- Create status enum for job submittals workflow
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'submittal_status'
      AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.submittal_status AS ENUM (
      'draft',
      'submitted',
      'in_review',
      'approved',
      'rejected',
      'closed'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.submittals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  submittal_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  spec_section TEXT,
  submitted_by UUID NOT NULL,
  assigned_to UUID,
  status public.submittal_status NOT NULL DEFAULT 'draft',
  due_date DATE,
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  review_notes TEXT,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT submittals_company_job_number_unique UNIQUE (company_id, job_id, submittal_number)
);

CREATE INDEX IF NOT EXISTS idx_submittals_company_id ON public.submittals(company_id);
CREATE INDEX IF NOT EXISTS idx_submittals_job_id ON public.submittals(job_id);
CREATE INDEX IF NOT EXISTS idx_submittals_status ON public.submittals(status);
CREATE INDEX IF NOT EXISTS idx_submittals_due_date ON public.submittals(due_date);

ALTER TABLE public.submittals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view submittals for accessible jobs" ON public.submittals;
CREATE POLICY "Users can view submittals for accessible jobs"
ON public.submittals
FOR SELECT
TO authenticated
USING (
  public.user_can_access_job(auth.uid(), submittals.job_id)
);

DROP POLICY IF EXISTS "Users can create submittals for accessible jobs" ON public.submittals;
CREATE POLICY "Users can create submittals for accessible jobs"
ON public.submittals
FOR INSERT
TO authenticated
WITH CHECK (
  submitted_by = auth.uid()
  AND company_id IN (SELECT company_id FROM public.get_user_companies(auth.uid()))
  AND public.user_can_access_job(auth.uid(), submittals.job_id)
);

DROP POLICY IF EXISTS "Users can update submittals for accessible jobs" ON public.submittals;
CREATE POLICY "Users can update submittals for accessible jobs"
ON public.submittals
FOR UPDATE
TO authenticated
USING (
  company_id IN (SELECT company_id FROM public.get_user_companies(auth.uid()))
  AND public.user_can_access_job(auth.uid(), submittals.job_id)
)
WITH CHECK (
  company_id IN (SELECT company_id FROM public.get_user_companies(auth.uid()))
  AND public.user_can_access_job(auth.uid(), submittals.job_id)
);

DROP POLICY IF EXISTS "Admins can delete submittals for accessible jobs" ON public.submittals;
CREATE POLICY "Admins can delete submittals for accessible jobs"
ON public.submittals
FOR DELETE
TO authenticated
USING (
  company_id IN (
    SELECT company_id
    FROM public.get_user_companies(auth.uid())
    WHERE role = ANY(ARRAY['admin'::user_role, 'controller'::user_role])
  )
  AND public.user_can_access_job(auth.uid(), submittals.job_id)
);

DROP TRIGGER IF EXISTS update_submittals_updated_at ON public.submittals;
CREATE TRIGGER update_submittals_updated_at
BEFORE UPDATE ON public.submittals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
