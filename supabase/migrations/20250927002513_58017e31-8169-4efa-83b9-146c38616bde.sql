-- Create visitor logs table
CREATE TABLE public.visitor_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  visitor_name TEXT NOT NULL,
  visitor_phone TEXT NOT NULL,
  company_name TEXT,
  subcontractor_id UUID,
  check_in_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  check_out_time TIMESTAMP WITH TIME ZONE,
  purpose_of_visit TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create job subcontractors table for dropdown options
CREATE TABLE public.job_subcontractors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Create visitor login settings table
CREATE TABLE public.visitor_login_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  background_image_url TEXT,
  header_logo_url TEXT,
  primary_color TEXT DEFAULT '#3b82f6',
  button_color TEXT DEFAULT '#10b981',
  confirmation_title TEXT DEFAULT 'Welcome to the Job Site!',
  confirmation_message TEXT DEFAULT 'Thank you for checking in. Please follow all safety protocols.',
  require_company_name BOOLEAN DEFAULT true,
  require_purpose_visit BOOLEAN DEFAULT false,
  enable_checkout BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  UNIQUE(company_id)
);

-- Add QR code to jobs table
ALTER TABLE public.jobs ADD COLUMN visitor_qr_code TEXT;

-- Function to generate QR codes for jobs
CREATE OR REPLACE FUNCTION public.generate_visitor_qr_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'VIS-' || upper(substring(gen_random_uuid()::text, 1, 12));
END;
$$;

-- Update existing jobs to have QR codes
UPDATE public.jobs 
SET visitor_qr_code = generate_visitor_qr_code() 
WHERE visitor_qr_code IS NULL;

-- Enable RLS on visitor tables
ALTER TABLE public.visitor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_login_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for visitor_logs
CREATE POLICY "Anyone can create visitor logs" 
ON public.visitor_logs 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Company users can view visitor logs for their jobs" 
ON public.visitor_logs 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND 
  EXISTS (
    SELECT 1 FROM public.jobs j 
    WHERE j.id = visitor_logs.job_id
  )
);

CREATE POLICY "Admins and managers can update visitor logs" 
ON public.visitor_logs 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'project_manager'::user_role) OR 
  has_role(auth.uid(), 'controller'::user_role)
);

-- RLS Policies for job_subcontractors
CREATE POLICY "Authenticated users can view job subcontractors" 
ON public.job_subcontractors 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Project managers and admins can manage job subcontractors" 
ON public.job_subcontractors 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'project_manager'::user_role) OR 
  has_role(auth.uid(), 'controller'::user_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'project_manager'::user_role) OR 
  has_role(auth.uid(), 'controller'::user_role)
);

-- RLS Policies for visitor_login_settings
CREATE POLICY "Company users can view their visitor login settings" 
ON public.visitor_login_settings 
FOR SELECT 
USING (
  auth.uid() IS NOT NULL AND 
  company_id IN (
    SELECT get_user_companies.company_id
    FROM get_user_companies(auth.uid()) get_user_companies(company_id, company_name, role)
  )
);

CREATE POLICY "Admins and controllers can manage visitor login settings" 
ON public.visitor_login_settings 
FOR ALL 
USING (
  company_id IN (
    SELECT get_user_companies.company_id
    FROM get_user_companies(auth.uid()) get_user_companies(company_id, company_name, role)
    WHERE get_user_companies.role = ANY (ARRAY['admin'::user_role, 'controller'::user_role])
  )
)
WITH CHECK (
  company_id IN (
    SELECT get_user_companies.company_id
    FROM get_user_companies(auth.uid()) get_user_companies(company_id, company_name, role)
    WHERE get_user_companies.role = ANY (ARRAY['admin'::user_role, 'controller'::user_role])
  )
);

-- Trigger to auto-generate QR codes for new jobs
CREATE OR REPLACE FUNCTION public.auto_generate_visitor_qr_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.visitor_qr_code IS NULL THEN
    NEW.visitor_qr_code = generate_visitor_qr_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_generate_visitor_qr_code_trigger
  BEFORE INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_visitor_qr_code();

-- Create updated_at trigger for visitor_logs
CREATE TRIGGER update_visitor_logs_updated_at
  BEFORE UPDATE ON public.visitor_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create updated_at trigger for visitor_login_settings
CREATE TRIGGER update_visitor_login_settings_updated_at
  BEFORE UPDATE ON public.visitor_login_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();