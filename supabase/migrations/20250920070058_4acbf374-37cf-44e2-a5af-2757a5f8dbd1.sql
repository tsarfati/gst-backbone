-- Create user management tables

-- Add approval status to profiles
ALTER TABLE public.profiles ADD COLUMN status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE public.profiles ADD COLUMN approved_by UUID REFERENCES auth.users(id);
ALTER TABLE public.profiles ADD COLUMN approved_at TIMESTAMP WITH TIME ZONE;

-- Create user job access table (for assigning specific jobs to users)
CREATE TABLE public.user_job_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  granted_by UUID NOT NULL REFERENCES auth.users(id),
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, job_id)
);

-- Create role permissions table for menu access
CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role user_role NOT NULL,
  menu_item TEXT NOT NULL,
  can_access BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role, menu_item)
);

-- Add global job access flag to profiles
ALTER TABLE public.profiles ADD COLUMN has_global_job_access BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE public.user_job_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_job_access
CREATE POLICY "Admins and controllers can view all job access" 
ON public.user_job_access 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

CREATE POLICY "Users can view their own job access" 
ON public.user_job_access 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins and controllers can manage job access" 
ON public.user_job_access 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

-- Create RLS policies for role_permissions
CREATE POLICY "All authenticated users can view role permissions" 
ON public.role_permissions 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can manage role permissions" 
ON public.role_permissions 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Insert default role permissions
INSERT INTO public.role_permissions (role, menu_item, can_access) VALUES
-- Admin access
('admin', 'dashboard', true),
('admin', 'jobs', true),
('admin', 'vendors', true),
('admin', 'employees', true),
('admin', 'receipts', true),
('admin', 'messages', true),
('admin', 'announcements', true),
('admin', 'settings', true),
('admin', 'reports', true),

-- Controller access
('controller', 'dashboard', true),
('controller', 'jobs', true),
('controller', 'vendors', true),
('controller', 'employees', true),
('controller', 'receipts', true),
('controller', 'messages', true),
('controller', 'announcements', false),
('controller', 'settings', false),
('controller', 'reports', true),

-- Employee access
('employee', 'dashboard', true),
('employee', 'jobs', false),
('employee', 'vendors', false),
('employee', 'employees', false),
('employee', 'receipts', true),
('employee', 'messages', true),
('employee', 'announcements', false),
('employee', 'settings', false),
('employee', 'reports', false);

-- Create trigger for updated_at column
CREATE TRIGGER update_role_permissions_updated_at
BEFORE UPDATE ON public.role_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();