-- Allow project managers to manage employee timecard settings
CREATE POLICY "Project managers can manage employee timecard settings" 
ON public.employee_timecard_settings
FOR ALL
USING (has_role(auth.uid(), 'project_manager'::user_role))
WITH CHECK (has_role(auth.uid(), 'project_manager'::user_role));

-- Allow project managers to manage job punch clock settings
CREATE POLICY "Project managers can manage job punch clock settings" 
ON public.job_punch_clock_settings
FOR ALL
USING (has_role(auth.uid(), 'project_manager'::user_role))
WITH CHECK (has_role(auth.uid(), 'project_manager'::user_role));