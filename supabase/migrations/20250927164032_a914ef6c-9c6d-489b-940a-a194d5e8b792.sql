-- Add company_id column to jobs table
ALTER TABLE public.jobs ADD COLUMN company_id uuid REFERENCES public.companies(id);

-- Update existing jobs to use the first company from user_company_access
-- This is a temporary fix for existing data - in production you'd want a more careful migration
UPDATE public.jobs 
SET company_id = (
  SELECT uca.company_id 
  FROM public.user_company_access uca 
  WHERE uca.user_id = jobs.created_by 
  LIMIT 1
)
WHERE company_id IS NULL;

-- Make company_id required for future jobs
ALTER TABLE public.jobs ALTER COLUMN company_id SET NOT NULL;

-- Update RLS policies for jobs to include company filtering
DROP POLICY IF EXISTS "Users can view all jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can create jobs" ON public.jobs;
DROP POLICY IF EXISTS "Project managers and admins can update jobs" ON public.jobs;

-- New RLS policies with company filtering
CREATE POLICY "Users can view jobs for their companies" ON public.jobs
FOR SELECT USING (
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc
  )
);

CREATE POLICY "Users can create jobs for their companies" ON public.jobs
FOR INSERT WITH CHECK (
  auth.uid() = created_by AND 
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc
  )
);

CREATE POLICY "Project managers and admins can update jobs for their companies" ON public.jobs
FOR UPDATE USING (
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc
  ) AND (
    auth.uid() = created_by OR 
    auth.uid() = project_manager_user_id OR 
    has_role(auth.uid(), 'admin'::user_role) OR 
    has_role(auth.uid(), 'controller'::user_role)
  )
);