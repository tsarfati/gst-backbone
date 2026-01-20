-- Create project roles table for configurable roles per company
CREATE TABLE public.project_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(company_id, name)
);

-- Create job project directory (team members per job)
CREATE TABLE public.job_project_directory (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    
    -- Contact information (always required)
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company_name TEXT, -- The company/firm they work for (not our company)
    
    -- Optional linking to existing entities
    linked_user_id UUID REFERENCES public.profiles(user_id) ON DELETE SET NULL,
    linked_vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    
    -- Role assignment
    project_role_id UUID REFERENCES public.project_roles(id) ON DELETE SET NULL,
    
    -- Additional fields
    notes TEXT,
    is_primary_contact BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.project_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_project_directory ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_roles
CREATE POLICY "Users can view project roles for their companies"
ON public.project_roles FOR SELECT
USING (
    company_id IN (
        SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Admins can manage project roles"
ON public.project_roles FOR ALL
USING (
    company_id IN (
        SELECT company_id FROM public.user_company_access 
        WHERE user_id = auth.uid() 
        AND role IN ('admin', 'company_admin', 'controller')
    )
);

-- RLS Policies for job_project_directory
CREATE POLICY "Users can view project directory for their companies"
ON public.job_project_directory FOR SELECT
USING (
    company_id IN (
        SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can manage project directory entries"
ON public.job_project_directory FOR INSERT
WITH CHECK (
    company_id IN (
        SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can update project directory entries"
ON public.job_project_directory FOR UPDATE
USING (
    company_id IN (
        SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can delete project directory entries"
ON public.job_project_directory FOR DELETE
USING (
    company_id IN (
        SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
    )
);

-- Create indexes for performance
CREATE INDEX idx_project_roles_company ON public.project_roles(company_id);
CREATE INDEX idx_job_project_directory_job ON public.job_project_directory(job_id);
CREATE INDEX idx_job_project_directory_company ON public.job_project_directory(company_id);

-- Insert default project roles
INSERT INTO public.project_roles (company_id, name, description, sort_order)
SELECT id, 'Project Manager', 'Oversees the overall project execution', 1 FROM public.companies
UNION ALL
SELECT id, 'Superintendent', 'Manages on-site construction activities', 2 FROM public.companies
UNION ALL
SELECT id, 'Architect', 'Design and architectural oversight', 3 FROM public.companies
UNION ALL
SELECT id, 'Owner Representative', 'Represents the property owner', 4 FROM public.companies
UNION ALL
SELECT id, 'General Contractor', 'Primary construction contractor', 5 FROM public.companies;

-- Add trigger for updated_at
CREATE TRIGGER update_project_roles_updated_at
BEFORE UPDATE ON public.project_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_project_directory_updated_at
BEFORE UPDATE ON public.job_project_directory
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();