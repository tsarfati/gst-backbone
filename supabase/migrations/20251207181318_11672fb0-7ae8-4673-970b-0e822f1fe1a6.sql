-- Add tracking columns for last update date and user
ALTER TABLE public.job_budget_forecasts
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_by UUID REFERENCES auth.users(id);

-- Create trigger to auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_job_budget_forecasts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger
DROP TRIGGER IF EXISTS update_job_budget_forecasts_updated_at ON public.job_budget_forecasts;
CREATE TRIGGER update_job_budget_forecasts_updated_at
  BEFORE UPDATE ON public.job_budget_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_job_budget_forecasts_timestamp();