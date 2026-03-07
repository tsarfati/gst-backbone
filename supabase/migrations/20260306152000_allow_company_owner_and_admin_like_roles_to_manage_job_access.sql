-- Ensure owner/company_admin/admin/controller can manage user job assignment data
-- even when profile.role is not synchronized with company access role.

-- Profiles: allow elevated company roles to update member profiles within shared companies.
DROP POLICY IF EXISTS "Company elevated roles can update profiles by shared company access" ON public.profiles;
CREATE POLICY "Company elevated roles can update profiles by shared company access"
ON public.profiles
FOR UPDATE
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.user_company_access actor
    JOIN public.user_company_access target
      ON target.company_id = actor.company_id
     AND target.user_id = profiles.user_id
     AND target.is_active = true
    WHERE actor.user_id = auth.uid()
      AND actor.is_active = true
      AND lower(actor.role::text) IN ('admin', 'controller', 'company_admin', 'owner')
  )
)
WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1
    FROM public.user_company_access actor
    JOIN public.user_company_access target
      ON target.company_id = actor.company_id
     AND target.user_id = profiles.user_id
     AND target.is_active = true
    WHERE actor.user_id = auth.uid()
      AND actor.is_active = true
      AND lower(actor.role::text) IN ('admin', 'controller', 'company_admin', 'owner')
  )
);

-- Employee timecard settings: company elevated roles can manage settings in their company.
DROP POLICY IF EXISTS "Company elevated roles can manage employee timecard settings" ON public.employee_timecard_settings;
CREATE POLICY "Company elevated roles can manage employee timecard settings"
ON public.employee_timecard_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.user_company_access actor
    WHERE actor.user_id = auth.uid()
      AND actor.company_id = employee_timecard_settings.company_id
      AND actor.is_active = true
      AND lower(actor.role::text) IN ('admin', 'controller', 'company_admin', 'owner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.user_company_access actor
    WHERE actor.user_id = auth.uid()
      AND actor.company_id = employee_timecard_settings.company_id
      AND actor.is_active = true
      AND lower(actor.role::text) IN ('admin', 'controller', 'company_admin', 'owner')
  )
);

-- User job access: company elevated roles can manage website/PM job assignments for jobs in their company.
DROP POLICY IF EXISTS "Company elevated roles can view user job access by company" ON public.user_job_access;
CREATE POLICY "Company elevated roles can view user job access by company"
ON public.user_job_access
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.user_company_access actor
      ON actor.company_id = j.company_id
    WHERE j.id = user_job_access.job_id
      AND actor.user_id = auth.uid()
      AND actor.is_active = true
      AND lower(actor.role::text) IN ('admin', 'controller', 'company_admin', 'owner')
  )
);

DROP POLICY IF EXISTS "Company elevated roles can insert user job access by company" ON public.user_job_access;
CREATE POLICY "Company elevated roles can insert user job access by company"
ON public.user_job_access
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.user_company_access actor
      ON actor.company_id = j.company_id
    WHERE j.id = user_job_access.job_id
      AND actor.user_id = auth.uid()
      AND actor.is_active = true
      AND lower(actor.role::text) IN ('admin', 'controller', 'company_admin', 'owner')
  )
);

DROP POLICY IF EXISTS "Company elevated roles can update user job access by company" ON public.user_job_access;
CREATE POLICY "Company elevated roles can update user job access by company"
ON public.user_job_access
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.user_company_access actor
      ON actor.company_id = j.company_id
    WHERE j.id = user_job_access.job_id
      AND actor.user_id = auth.uid()
      AND actor.is_active = true
      AND lower(actor.role::text) IN ('admin', 'controller', 'company_admin', 'owner')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.user_company_access actor
      ON actor.company_id = j.company_id
    WHERE j.id = user_job_access.job_id
      AND actor.user_id = auth.uid()
      AND actor.is_active = true
      AND lower(actor.role::text) IN ('admin', 'controller', 'company_admin', 'owner')
  )
);

DROP POLICY IF EXISTS "Company elevated roles can delete user job access by company" ON public.user_job_access;
CREATE POLICY "Company elevated roles can delete user job access by company"
ON public.user_job_access
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.jobs j
    JOIN public.user_company_access actor
      ON actor.company_id = j.company_id
    WHERE j.id = user_job_access.job_id
      AND actor.user_id = auth.uid()
      AND actor.is_active = true
      AND lower(actor.role::text) IN ('admin', 'controller', 'company_admin', 'owner')
  )
);
