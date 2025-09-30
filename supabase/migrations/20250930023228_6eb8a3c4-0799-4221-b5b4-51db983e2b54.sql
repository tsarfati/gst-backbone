-- Fix the function security by setting search_path
CREATE OR REPLACE FUNCTION cleanup_job_budget_on_cost_code_removal()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle DELETE - remove job budget entries for deleted cost codes
  IF TG_OP = 'DELETE' THEN
    DELETE FROM job_budgets WHERE cost_code_id = OLD.id;
    RETURN OLD;
  END IF;
  
  -- Handle UPDATE - check if cost code is being deactivated
  IF TG_OP = 'UPDATE' THEN
    -- If cost code is deactivated, remove from job budget
    IF OLD.is_active = true AND NEW.is_active = false THEN
      DELETE FROM job_budgets WHERE cost_code_id = NEW.id;
    END IF;
    
    -- If cost code is moved to a different job, remove from old job's budget
    IF OLD.job_id IS DISTINCT FROM NEW.job_id THEN
      DELETE FROM job_budgets 
      WHERE cost_code_id = NEW.id AND (job_id = OLD.job_id OR job_id = NEW.job_id);
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;