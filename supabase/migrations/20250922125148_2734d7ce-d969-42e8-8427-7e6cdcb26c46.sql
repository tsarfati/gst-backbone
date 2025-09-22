-- Create a table to track company access requests
CREATE TABLE IF NOT EXISTS public.company_access_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

-- Enable RLS
ALTER TABLE public.company_access_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_access_requests
CREATE POLICY "Users can view their own access requests"
ON public.company_access_requests
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own access requests"
ON public.company_access_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Company admins can view requests for their companies"
ON public.company_access_requests
FOR SELECT
USING (
  company_id IN (
    SELECT get_user_companies.company_id
    FROM get_user_companies(auth.uid()) get_user_companies(company_id, company_name, role)
    WHERE get_user_companies.role = ANY (ARRAY['admin'::user_role, 'controller'::user_role])
  )
);

CREATE POLICY "Company admins can update requests for their companies"
ON public.company_access_requests
FOR UPDATE
USING (
  company_id IN (
    SELECT get_user_companies.company_id
    FROM get_user_companies(auth.uid()) get_user_companies(company_id, company_name, role)
    WHERE get_user_companies.role = ANY (ARRAY['admin'::user_role, 'controller'::user_role])
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_company_access_requests_updated_at
BEFORE UPDATE ON public.company_access_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();