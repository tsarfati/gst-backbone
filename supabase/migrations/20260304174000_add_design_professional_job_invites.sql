CREATE TABLE IF NOT EXISTS public.design_professional_job_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  invite_token text NOT NULL UNIQUE,
  email text NOT NULL,
  first_name text,
  last_name text,
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  accepted_by_user_id uuid,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  notes jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_dp_job_invites_company_job
  ON public.design_professional_job_invites(company_id, job_id, status);
CREATE INDEX IF NOT EXISTS idx_dp_job_invites_email
  ON public.design_professional_job_invites(email);

ALTER TABLE public.design_professional_job_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dp_job_invites_select_company_access" ON public.design_professional_job_invites;
CREATE POLICY "dp_job_invites_select_company_access"
ON public.design_professional_job_invites
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = design_professional_job_invites.company_id
      AND COALESCE(uca.is_active, true) = true
  )
);

DROP POLICY IF EXISTS "dp_job_invites_insert_admin_pm" ON public.design_professional_job_invites;
CREATE POLICY "dp_job_invites_insert_admin_pm"
ON public.design_professional_job_invites
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = design_professional_job_invites.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text IN ('admin', 'company_admin', 'controller', 'owner', 'project_manager')
  )
);

DROP POLICY IF EXISTS "dp_job_invites_update_admin_pm" ON public.design_professional_job_invites;
CREATE POLICY "dp_job_invites_update_admin_pm"
ON public.design_professional_job_invites
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = design_professional_job_invites.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text IN ('admin', 'company_admin', 'controller', 'owner', 'project_manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = auth.uid()
      AND uca.company_id = design_professional_job_invites.company_id
      AND COALESCE(uca.is_active, true) = true
      AND uca.role::text IN ('admin', 'company_admin', 'controller', 'owner', 'project_manager')
  )
);

DROP TRIGGER IF EXISTS update_dp_job_invites_updated_at ON public.design_professional_job_invites;
CREATE TRIGGER update_dp_job_invites_updated_at
BEFORE UPDATE ON public.design_professional_job_invites
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
