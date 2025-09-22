-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT,
  logo_url TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  tax_id TEXT,
  license_number TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Migrate existing vendor company_ids to companies table
INSERT INTO public.companies (id, name, created_by)
SELECT DISTINCT 
  v.company_id,
  COALESCE(p.display_name, p.first_name || ' ' || p.last_name, 'Company') as name,
  v.company_id
FROM vendors v
LEFT JOIN profiles p ON p.user_id = v.company_id
WHERE v.company_id IS NOT NULL;

-- Create user_company_access table
CREATE TABLE public.user_company_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'employee',
  is_active BOOLEAN NOT NULL DEFAULT true,
  granted_by UUID NOT NULL,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Enable RLS
ALTER TABLE public.user_company_access ENABLE ROW LEVEL SECURITY;

-- Add current_company_id to profiles table
ALTER TABLE public.profiles ADD COLUMN current_company_id UUID REFERENCES public.companies(id);

-- Create user_company_access records for existing users
INSERT INTO public.user_company_access (user_id, company_id, role, granted_by)
SELECT DISTINCT 
  v.company_id as user_id,
  v.company_id as company_id,
  'admin' as role,
  v.company_id as granted_by
FROM vendors v
WHERE v.company_id IS NOT NULL;

-- Update profiles to set current_company_id
UPDATE public.profiles 
SET current_company_id = user_id
WHERE user_id IN (SELECT DISTINCT company_id FROM vendors WHERE company_id IS NOT NULL);

-- Now add the foreign key constraint to vendors
ALTER TABLE public.vendors ADD CONSTRAINT vendors_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

-- Create RLS policies for companies
CREATE POLICY "Users can view companies they have access to" 
ON public.companies 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_company_access 
    WHERE user_id = auth.uid() 
    AND company_id = companies.id 
    AND is_active = true
  )
);

CREATE POLICY "Company admins can update their companies" 
ON public.companies 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_company_access 
    WHERE user_id = auth.uid() 
    AND company_id = companies.id 
    AND role IN ('admin', 'controller')
    AND is_active = true
  )
);

CREATE POLICY "Users can create companies" 
ON public.companies 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

-- Create RLS policies for user_company_access
CREATE POLICY "Users can view their own company access" 
ON public.user_company_access 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Company admins can view all access for their companies" 
ON public.user_company_access 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_company_access uca2
    WHERE uca2.user_id = auth.uid() 
    AND uca2.company_id = user_company_access.company_id
    AND uca2.role IN ('admin', 'controller')
    AND uca2.is_active = true
  )
);

CREATE POLICY "Company admins can manage user access" 
ON public.user_company_access 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_company_access uca2
    WHERE uca2.user_id = auth.uid() 
    AND uca2.company_id = user_company_access.company_id
    AND uca2.role IN ('admin', 'controller')
    AND uca2.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_company_access uca2
    WHERE uca2.user_id = auth.uid() 
    AND uca2.company_id = user_company_access.company_id
    AND uca2.role IN ('admin', 'controller')
    AND uca2.is_active = true
  )
);

-- Create security definer functions for company access
CREATE OR REPLACE FUNCTION public.get_user_companies(_user_id UUID)
RETURNS TABLE(company_id UUID, company_name TEXT, role user_role)
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT uca.company_id, c.name, uca.role
  FROM user_company_access uca
  JOIN companies c ON c.id = uca.company_id
  WHERE uca.user_id = _user_id AND uca.is_active = true AND c.is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.has_company_access(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_company_access
    WHERE user_id = _user_id 
    AND company_id = _company_id 
    AND is_active = true
  );
$$;

-- Update existing RLS policies to include company filtering
-- Update vendors policies
DROP POLICY IF EXISTS "Users can view vendors for their company" ON public.vendors;
CREATE POLICY "Users can view vendors for their company" 
ON public.vendors 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_company_access 
    WHERE user_id = auth.uid() 
    AND company_id = vendors.company_id 
    AND is_active = true
  )
);

DROP POLICY IF EXISTS "Users can create vendors for their company" ON public.vendors;
CREATE POLICY "Users can create vendors for their company" 
ON public.vendors 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_company_access 
    WHERE user_id = auth.uid() 
    AND company_id = vendors.company_id 
    AND is_active = true
  )
);

DROP POLICY IF EXISTS "Users can update vendors for their company" ON public.vendors;
CREATE POLICY "Users can update vendors for their company" 
ON public.vendors 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_company_access 
    WHERE user_id = auth.uid() 
    AND company_id = vendors.company_id 
    AND is_active = true
  )
);

DROP POLICY IF EXISTS "Users can delete vendors for their company" ON public.vendors;
CREATE POLICY "Users can delete vendors for their company" 
ON public.vendors 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_company_access 
    WHERE user_id = auth.uid() 
    AND company_id = vendors.company_id 
    AND is_active = true
  )
);

-- Add trigger for updating timestamps
CREATE TRIGGER update_companies_updated_at
BEFORE UPDATE ON companies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();