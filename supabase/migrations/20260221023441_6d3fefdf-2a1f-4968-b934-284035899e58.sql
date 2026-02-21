
-- Create table to store per-user, per-job cost code assignments
CREATE TABLE public.user_job_cost_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  cost_code_id UUID NOT NULL REFERENCES public.cost_codes(id) ON DELETE CASCADE,
  granted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, job_id, cost_code_id)
);

-- Enable RLS
ALTER TABLE public.user_job_cost_codes ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users in the same company can manage
CREATE POLICY "Users can view job cost code assignments"
  ON public.user_job_cost_codes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_company_access uca
      JOIN public.jobs j ON j.company_id = uca.company_id
      WHERE uca.user_id = auth.uid()
        AND uca.is_active = true
        AND j.id = user_job_cost_codes.job_id
    )
  );

CREATE POLICY "Admins can insert job cost code assignments"
  ON public.user_job_cost_codes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_company_access uca
      JOIN public.jobs j ON j.company_id = uca.company_id
      WHERE uca.user_id = auth.uid()
        AND uca.is_active = true
        AND uca.role IN ('admin', 'controller', 'company_admin', 'project_manager')
        AND j.id = user_job_cost_codes.job_id
    )
  );

CREATE POLICY "Admins can delete job cost code assignments"
  ON public.user_job_cost_codes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_company_access uca
      JOIN public.jobs j ON j.company_id = uca.company_id
      WHERE uca.user_id = auth.uid()
        AND uca.is_active = true
        AND uca.role IN ('admin', 'controller', 'company_admin', 'project_manager')
        AND j.id = user_job_cost_codes.job_id
    )
  );

-- Add index for performance
CREATE INDEX idx_user_job_cost_codes_user_id ON public.user_job_cost_codes(user_id);
CREATE INDEX idx_user_job_cost_codes_job_id ON public.user_job_cost_codes(job_id);
