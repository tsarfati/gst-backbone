-- Add revenue account association to jobs table
ALTER TABLE public.jobs 
ADD COLUMN revenue_account_id uuid REFERENCES public.chart_of_accounts(id);

-- Create account associations table for job and cost code settings
CREATE TABLE public.account_associations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    association_type text NOT NULL, -- 'job_revenue' or 'cost_code_construction'
    job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
    cost_code_id uuid REFERENCES public.cost_codes(id) ON DELETE CASCADE,
    account_id uuid NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid NOT NULL,
    
    -- Ensure proper associations
    CONSTRAINT check_association_type CHECK (association_type IN ('job_revenue', 'cost_code_construction')),
    CONSTRAINT check_job_revenue CHECK (
        (association_type = 'job_revenue' AND job_id IS NOT NULL AND cost_code_id IS NULL) OR
        (association_type = 'cost_code_construction' AND cost_code_id IS NOT NULL AND job_id IS NULL)
    )
);

-- Enable RLS on account_associations
ALTER TABLE public.account_associations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for account_associations
CREATE POLICY "Users can view account associations for their companies"
ON public.account_associations FOR SELECT
USING (company_id IN (
    SELECT uc.company_id FROM get_user_companies(auth.uid()) uc
));

CREATE POLICY "Admins and controllers can manage account associations"
ON public.account_associations FOR ALL
USING (company_id IN (
    SELECT uc.company_id FROM get_user_companies(auth.uid()) uc
    WHERE uc.role = ANY (ARRAY['admin'::user_role, 'controller'::user_role])
))
WITH CHECK (company_id IN (
    SELECT uc.company_id FROM get_user_companies(auth.uid()) uc
    WHERE uc.role = ANY (ARRAY['admin'::user_role, 'controller'::user_role])
));

-- Add updated_at trigger for account_associations
CREATE TRIGGER update_account_associations_updated_at
    BEFORE UPDATE ON public.account_associations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();