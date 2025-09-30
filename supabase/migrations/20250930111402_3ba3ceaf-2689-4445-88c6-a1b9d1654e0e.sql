-- Add parent_cost_code_id to cost_codes for hierarchical structure
ALTER TABLE public.cost_codes
ADD COLUMN parent_cost_code_id uuid REFERENCES public.cost_codes(id) ON DELETE CASCADE;

-- Add index for better performance on parent lookups
CREATE INDEX idx_cost_codes_parent ON public.cost_codes(parent_cost_code_id);

-- Add dynamic budget fields to job_budgets
ALTER TABLE public.job_budgets
ADD COLUMN is_dynamic boolean DEFAULT false,
ADD COLUMN parent_budget_id uuid REFERENCES public.job_budgets(id) ON DELETE CASCADE;

-- Add index for parent budget lookups
CREATE INDEX idx_job_budgets_parent ON public.job_budgets(parent_budget_id);

-- Create a view to calculate dynamic budget totals
CREATE OR REPLACE VIEW public.dynamic_budget_summary AS
SELECT 
  jb.id as parent_budget_id,
  jb.job_id,
  jb.cost_code_id as parent_cost_code_id,
  jb.budgeted_amount as dynamic_budget,
  COALESCE(SUM(child_jb.actual_amount), 0) as total_actual_from_children,
  COALESCE(SUM(child_jb.committed_amount), 0) as total_committed_from_children,
  jb.budgeted_amount - COALESCE(SUM(child_jb.actual_amount), 0) as remaining_budget,
  CASE 
    WHEN COALESCE(SUM(child_jb.actual_amount), 0) > jb.budgeted_amount 
    THEN true 
    ELSE false 
  END as is_over_budget
FROM public.job_budgets jb
LEFT JOIN public.job_budgets child_jb ON child_jb.parent_budget_id = jb.id
WHERE jb.is_dynamic = true
GROUP BY jb.id, jb.job_id, jb.cost_code_id, jb.budgeted_amount;

-- Grant access to the view
GRANT SELECT ON public.dynamic_budget_summary TO authenticated;

-- Create function to update actual amounts for dynamic budget children
CREATE OR REPLACE FUNCTION public.update_dynamic_budget_actuals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When an invoice with a cost code is created/updated, update the job budget actual amount
  IF NEW.cost_code_id IS NOT NULL AND NEW.job_id IS NOT NULL THEN
    -- Check if this cost code has a job budget entry
    INSERT INTO public.job_budgets (
      job_id,
      cost_code_id,
      budgeted_amount,
      actual_amount,
      committed_amount,
      created_by,
      parent_budget_id
    )
    SELECT 
      NEW.job_id,
      NEW.cost_code_id,
      0, -- No budget for dynamic child codes
      NEW.amount,
      0,
      NEW.created_by,
      (
        SELECT jb.id 
        FROM public.job_budgets jb
        JOIN public.cost_codes cc ON cc.id = jb.cost_code_id
        WHERE jb.job_id = NEW.job_id 
          AND jb.is_dynamic = true
          AND cc.id = (
            SELECT parent_cost_code_id 
            FROM public.cost_codes 
            WHERE id = NEW.cost_code_id
          )
        LIMIT 1
      )
    ON CONFLICT (job_id, cost_code_id) 
    DO UPDATE SET 
      actual_amount = job_budgets.actual_amount + NEW.amount,
      updated_at = now();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to update dynamic budget actuals when invoices are created
CREATE TRIGGER trigger_update_dynamic_budget_actuals
AFTER INSERT OR UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_dynamic_budget_actuals();

-- Add comment to explain the dynamic budget system
COMMENT ON COLUMN public.job_budgets.is_dynamic IS 'Marks this budget as a dynamic budget group that accumulates costs from child cost codes';
COMMENT ON COLUMN public.job_budgets.parent_budget_id IS 'References the parent dynamic budget that this child budget rolls up to';
COMMENT ON COLUMN public.cost_codes.parent_cost_code_id IS 'References the parent cost code for hierarchical cost code structures';