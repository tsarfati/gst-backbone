-- Create table for assistant project managers on jobs
CREATE TABLE public.job_assistant_managers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  user_id UUID NOT NULL,
  assigned_by UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.job_assistant_managers ENABLE ROW LEVEL SECURITY;

-- Create policies for job assistant managers
CREATE POLICY "Admins and controllers can manage assistant managers" 
ON public.job_assistant_managers 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

CREATE POLICY "Project managers can view assistant managers for their jobs" 
ON public.job_assistant_managers 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.jobs 
    WHERE jobs.id = job_assistant_managers.job_id 
    AND (jobs.project_manager_user_id = auth.uid() OR jobs.created_by = auth.uid())
  )
);

CREATE POLICY "Assistant managers can view their own assignments" 
ON public.job_assistant_managers 
FOR SELECT 
USING (auth.uid() = user_id);