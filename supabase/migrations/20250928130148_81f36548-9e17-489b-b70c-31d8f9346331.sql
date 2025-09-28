-- Add company_id to delivery_tickets table and make it company-specific
ALTER TABLE public.delivery_tickets ADD COLUMN company_id uuid REFERENCES public.companies(id);

-- Update existing delivery tickets to set company_id based on job relationship
UPDATE public.delivery_tickets 
SET company_id = jobs.company_id 
FROM public.jobs 
WHERE delivery_tickets.job_id = jobs.id;

-- Make company_id NOT NULL after setting values
ALTER TABLE public.delivery_tickets ALTER COLUMN company_id SET NOT NULL;

-- Add company_id to visitor_logs table and make it company-specific
ALTER TABLE public.visitor_logs ADD COLUMN company_id uuid REFERENCES public.companies(id);

-- Update existing visitor logs to set company_id based on job relationship
UPDATE public.visitor_logs 
SET company_id = jobs.company_id 
FROM public.jobs 
WHERE visitor_logs.job_id = jobs.id;

-- Make company_id NOT NULL after setting values
ALTER TABLE public.visitor_logs ALTER COLUMN company_id SET NOT NULL;

-- Update RLS policies for delivery_tickets
DROP POLICY IF EXISTS "All authenticated users can view delivery tickets" ON public.delivery_tickets;
DROP POLICY IF EXISTS "Project managers and admins can manage delivery tickets" ON public.delivery_tickets;

CREATE POLICY "Users can view delivery tickets for their companies" 
ON public.delivery_tickets 
FOR SELECT 
USING (
  company_id IN (
    SELECT uc.company_id
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
  )
);

CREATE POLICY "Project managers and admins can manage delivery tickets for their companies" 
ON public.delivery_tickets 
FOR ALL 
USING (
  company_id IN (
    SELECT uc.company_id
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
    WHERE uc.role = ANY (ARRAY['admin'::user_role, 'controller'::user_role, 'project_manager'::user_role])
  )
)
WITH CHECK (
  company_id IN (
    SELECT uc.company_id
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
    WHERE uc.role = ANY (ARRAY['admin'::user_role, 'controller'::user_role, 'project_manager'::user_role])
  )
);

-- Update RLS policies for visitor_logs
DROP POLICY IF EXISTS "Users can view visitor logs for their assigned jobs" ON public.visitor_logs;
DROP POLICY IF EXISTS "Project managers and admins can manage visitor logs" ON public.visitor_logs;

CREATE POLICY "Users can view visitor logs for their companies" 
ON public.visitor_logs 
FOR SELECT 
USING (
  company_id IN (
    SELECT uc.company_id
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
  )
);

CREATE POLICY "Project managers and admins can manage visitor logs for their companies" 
ON public.visitor_logs 
FOR ALL 
USING (
  company_id IN (
    SELECT uc.company_id
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
    WHERE uc.role = ANY (ARRAY['admin'::user_role, 'controller'::user_role, 'project_manager'::user_role])
  )
)
WITH CHECK (
  company_id IN (
    SELECT uc.company_id
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
    WHERE uc.role = ANY (ARRAY['admin'::user_role, 'controller'::user_role, 'project_manager'::user_role])
  )
);