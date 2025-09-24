-- Fix RLS policy for job_assistant_managers table
-- The current policy is too restrictive and preventing project managers from adding assistant managers

-- Drop existing policies for job_assistant_managers
DROP POLICY IF EXISTS "Admins and controllers can manage assistant managers" ON public.job_assistant_managers;
DROP POLICY IF EXISTS "Assistant managers can view their own assignments" ON public.job_assistant_managers;
DROP POLICY IF EXISTS "Project managers can view assistant managers for their jobs" ON public.job_assistant_managers;

-- Create new RLS policies for job_assistant_managers that allow proper access
CREATE POLICY "Admins and controllers can manage assistant managers" 
ON public.job_assistant_managers 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

CREATE POLICY "Project managers can manage assistant managers for their jobs" 
ON public.job_assistant_managers 
FOR ALL 
USING (
  has_role(auth.uid(), 'project_manager'::user_role) AND 
  EXISTS (
    SELECT 1 FROM jobs 
    WHERE jobs.id = job_assistant_managers.job_id 
    AND (jobs.project_manager_user_id = auth.uid() OR jobs.created_by = auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'project_manager'::user_role) AND 
  EXISTS (
    SELECT 1 FROM jobs 
    WHERE jobs.id = job_assistant_managers.job_id 
    AND (jobs.project_manager_user_id = auth.uid() OR jobs.created_by = auth.uid())
  )
);

CREATE POLICY "Assistant managers can view their own assignments" 
ON public.job_assistant_managers 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can view assistant managers for jobs they have access to" 
ON public.job_assistant_managers 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND (
    -- Admin/controller access
    has_role(auth.uid(), 'admin'::user_role) OR 
    has_role(auth.uid(), 'controller'::user_role) OR
    -- Project manager access to their jobs
    EXISTS (
      SELECT 1 FROM jobs 
      WHERE jobs.id = job_assistant_managers.job_id 
      AND (jobs.project_manager_user_id = auth.uid() OR jobs.created_by = auth.uid())
    ) OR
    -- Assistant manager can see their own assignment
    auth.uid() = user_id
  )
);