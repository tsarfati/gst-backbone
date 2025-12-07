-- Create table to store PM's estimated percentage complete for each budget line
CREATE TABLE public.job_budget_forecasts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  cost_code_id UUID NOT NULL REFERENCES public.cost_codes(id) ON DELETE CASCADE,
  estimated_percent_complete NUMERIC(5,2) DEFAULT 0 CHECK (estimated_percent_complete >= 0 AND estimated_percent_complete <= 100),
  notes TEXT,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, cost_code_id)
);

-- Enable RLS
ALTER TABLE public.job_budget_forecasts ENABLE ROW LEVEL SECURITY;

-- Create policies for company access
CREATE POLICY "Users can view job budget forecasts for their company jobs"
ON public.job_budget_forecasts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.user_company_access uca ON uca.company_id = j.company_id
    WHERE j.id = job_budget_forecasts.job_id
    AND uca.user_id = auth.uid()
    AND uca.is_active = true
  )
);

CREATE POLICY "Users can insert job budget forecasts for their company jobs"
ON public.job_budget_forecasts
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.user_company_access uca ON uca.company_id = j.company_id
    WHERE j.id = job_budget_forecasts.job_id
    AND uca.user_id = auth.uid()
    AND uca.is_active = true
  )
);

CREATE POLICY "Users can update job budget forecasts for their company jobs"
ON public.job_budget_forecasts
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.user_company_access uca ON uca.company_id = j.company_id
    WHERE j.id = job_budget_forecasts.job_id
    AND uca.user_id = auth.uid()
    AND uca.is_active = true
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_job_budget_forecasts_updated_at
BEFORE UPDATE ON public.job_budget_forecasts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();