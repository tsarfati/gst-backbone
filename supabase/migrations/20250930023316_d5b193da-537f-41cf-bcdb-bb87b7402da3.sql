-- Drop and recreate trigger with explicit schema names
DROP TRIGGER IF EXISTS job_budget_cleanup_trigger ON public.cost_codes;

-- Create the trigger on the cost_codes table
CREATE TRIGGER job_budget_cleanup_trigger
  AFTER UPDATE OR DELETE ON public.cost_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_job_budget_on_cost_code_removal();