-- Create table for job-specific bill approval settings
CREATE TABLE public.job_bill_approval_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL,
  company_id UUID NOT NULL,
  require_approval BOOLEAN NOT NULL DEFAULT true,
  approval_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
  approver_user_ids UUID[] DEFAULT ARRAY[]::UUID[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  UNIQUE(job_id, company_id)
);

-- Enable Row Level Security
ALTER TABLE public.job_bill_approval_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins and controllers can manage job bill approval settings"
ON public.job_bill_approval_settings
FOR ALL
USING (company_id IN (
  SELECT company_id FROM get_user_companies(auth.uid())
  WHERE role = ANY(ARRAY['admin'::user_role, 'controller'::user_role])
))
WITH CHECK (company_id IN (
  SELECT company_id FROM get_user_companies(auth.uid())
  WHERE role = ANY(ARRAY['admin'::user_role, 'controller'::user_role])
));

CREATE POLICY "Users can view job bill approval settings for their companies"
ON public.job_bill_approval_settings
FOR SELECT
USING (company_id IN (
  SELECT company_id FROM get_user_companies(auth.uid())
));

-- Create trigger for updated_at
CREATE TRIGGER update_job_bill_approval_settings_updated_at
BEFORE UPDATE ON public.job_bill_approval_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();