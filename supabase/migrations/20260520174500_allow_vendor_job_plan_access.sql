-- Allow vendor portal users to read job plans when the builder explicitly
-- granted plan access on vendor_job_access for that job.
--
-- Keep this scoped to plans only. Other job-linked tables have their own
-- permission columns and should get separate policies instead of broadening
-- user_can_access_job() for every vendor assignment.

DROP POLICY IF EXISTS "Vendors can view job plans for assigned vendor jobs" ON public.job_plans;

CREATE POLICY "Vendors can view job plans for assigned vendor jobs"
ON public.job_plans
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.vendor_job_access vja
    WHERE vja.job_id = job_plans.job_id
      AND vja.can_view_plans = true
      AND public.user_has_vendor_access(auth.uid(), vja.vendor_id)
  )
);
