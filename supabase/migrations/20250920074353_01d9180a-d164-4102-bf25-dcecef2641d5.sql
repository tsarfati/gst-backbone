-- Create user_menu_permissions table
CREATE TABLE public.user_menu_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  menu_item TEXT NOT NULL,
  can_access BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, menu_item)
);

-- Create user_job_access table
CREATE TABLE public.user_job_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  can_access BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, job_id)
);

-- Create page_locks table for development freeze
CREATE TABLE public.page_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page_name TEXT NOT NULL UNIQUE,
  page_path TEXT NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_by UUID REFERENCES auth.users(id),
  locked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_menu_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_job_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_locks ENABLE ROW LEVEL SECURITY;

-- Create policies for user_menu_permissions
CREATE POLICY "Admin and controllers can manage menu permissions"
ON public.user_menu_permissions
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'controller')
  )
);

-- Create policies for user_job_access
CREATE POLICY "Admin and controllers can manage job access"
ON public.user_job_access
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'controller')
  )
);

-- Create policies for page_locks
CREATE POLICY "Admin and controllers can manage page locks"
ON public.page_locks
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'controller')
  )
);

-- Add triggers for updated_at
CREATE TRIGGER update_user_menu_permissions_updated_at
BEFORE UPDATE ON public.user_menu_permissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_job_access_updated_at
BEFORE UPDATE ON public.user_job_access
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_page_locks_updated_at
BEFORE UPDATE ON public.page_locks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();