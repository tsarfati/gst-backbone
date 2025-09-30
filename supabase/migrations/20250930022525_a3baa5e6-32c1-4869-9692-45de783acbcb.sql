-- Function to clean up job budget entries when cost codes are removed
CREATE OR REPLACE FUNCTION public.cleanup_job_budget_on_cost_code_removal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Handle DELETE - remove job budget entries for deleted cost codes
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.job_budgets 
    WHERE cost_code_id = OLD.id AND job_id = OLD.job_id;
    RETURN OLD;
  END IF;
  
  -- Handle UPDATE - check if cost code is being deactivated or moved to different job
  IF TG_OP = 'UPDATE' THEN
    -- If cost code is deactivated, remove from job budget
    IF OLD.is_active = true AND NEW.is_active = false THEN
      DELETE FROM public.job_budgets 
      WHERE cost_code_id = NEW.id AND job_id = NEW.job_id;
    END IF;
    
    -- If cost code is moved to a different job, remove from old job's budget
    IF OLD.job_id IS DISTINCT FROM NEW.job_id AND OLD.job_id IS NOT NULL THEN
      DELETE FROM public.job_budgets 
      WHERE cost_code_id = NEW.id AND job_id = OLD.job_id;
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

-- Create trigger to automatically clean up job budgets when cost codes are removed
DROP TRIGGER IF EXISTS cleanup_job_budget_on_cost_code_removal ON public.cost_codes;
CREATE TRIGGER cleanup_job_budget_on_cost_code_removal
  AFTER UPDATE OR DELETE ON public.cost_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_job_budget_on_cost_code_removal();