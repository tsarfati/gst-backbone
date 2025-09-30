-- Add is_dynamic_group flag to distinguish groups from regular dynamic codes
ALTER TABLE public.cost_codes
ADD COLUMN IF NOT EXISTS is_dynamic_group boolean DEFAULT false;

-- Ensure chart_account_id column exists for linking to chart of accounts
-- (already exists based on schema, but adding check for completeness)

-- Create a function to auto-set parent relationships based on code structure
CREATE OR REPLACE FUNCTION public.set_cost_code_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_code_text text;
  parent_id uuid;
BEGIN
  -- Only set parent if not already set and not a dynamic group
  IF NEW.parent_cost_code_id IS NULL AND NEW.is_dynamic_group = false THEN
    
    -- Case 1: Child code pattern (e.g., 1.09.01) -> parent to 1.09
    IF NEW.code ~ '^\d+\.\d+\.\d+' THEN
      -- Extract parent code (first two segments)
      parent_code_text := substring(NEW.code from '^(\d+\.\d+)');
      
      -- Find the parent cost code
      SELECT id INTO parent_id
      FROM public.cost_codes
      WHERE code = parent_code_text
        AND company_id = NEW.company_id
        AND (job_id IS NOT DISTINCT FROM NEW.job_id)
      LIMIT 1;
      
      IF parent_id IS NOT NULL THEN
        NEW.parent_cost_code_id := parent_id;
      END IF;
      
    -- Case 2: Parent code pattern (e.g., 1.09) -> parent to group '1'
    ELSIF NEW.code ~ '^\d+\.\d+$' THEN
      -- Extract group code (first segment)
      parent_code_text := substring(NEW.code from '^(\d+)');
      
      -- Find the dynamic group
      SELECT id INTO parent_id
      FROM public.cost_codes
      WHERE code = parent_code_text
        AND company_id = NEW.company_id
        AND is_dynamic_group = true
        AND (job_id IS NOT DISTINCT FROM NEW.job_id)
      LIMIT 1;
      
      IF parent_id IS NOT NULL THEN
        NEW.parent_cost_code_id := parent_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-set parent relationships
DROP TRIGGER IF EXISTS trigger_set_cost_code_parent ON public.cost_codes;
CREATE TRIGGER trigger_set_cost_code_parent
  BEFORE INSERT ON public.cost_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cost_code_parent();

-- Update the dynamic_budget_summary view to handle groups
DROP VIEW IF EXISTS public.dynamic_budget_summary;
CREATE VIEW public.dynamic_budget_summary AS
SELECT
  jb.id as parent_budget_id,
  jb.job_id,
  jb.cost_code_id as parent_cost_code_id,
  cc.code as cost_code,
  cc.description as cost_code_description,
  cc.is_dynamic_group,
  jb.budgeted_amount as dynamic_budget,
  COALESCE(SUM(child_jb.actual_amount), 0) as total_actual_from_children,
  COALESCE(SUM(child_jb.committed_amount), 0) as total_committed_from_children,
  jb.budgeted_amount - COALESCE(SUM(child_jb.actual_amount), 0) as remaining_budget,
  CASE 
    WHEN COALESCE(SUM(child_jb.actual_amount), 0) > jb.budgeted_amount THEN true
    ELSE false
  END as is_over_budget,
  COUNT(child_jb.id) as child_count
FROM public.job_budgets jb
JOIN public.cost_codes cc ON cc.id = jb.cost_code_id
LEFT JOIN public.cost_codes child_cc ON child_cc.parent_cost_code_id = cc.id
LEFT JOIN public.job_budgets child_jb ON child_jb.cost_code_id = child_cc.id AND child_jb.job_id = jb.job_id
WHERE jb.is_dynamic = true
GROUP BY jb.id, jb.job_id, jb.cost_code_id, cc.code, cc.description, cc.is_dynamic_group, jb.budgeted_amount;

-- Grant access to the view
GRANT SELECT ON public.dynamic_budget_summary TO authenticated;

COMMENT ON COLUMN public.cost_codes.is_dynamic_group IS 'True for top-level dynamic groups (e.g., "1") that parent multiple dynamic codes';
COMMENT ON COLUMN public.cost_codes.parent_cost_code_id IS 'Links child codes to parent. E.g., 1.09.01 -> 1.09 -> 1';
COMMENT ON COLUMN public.cost_codes.chart_account_id IS 'Links cost code to chart of accounts for financial reporting';