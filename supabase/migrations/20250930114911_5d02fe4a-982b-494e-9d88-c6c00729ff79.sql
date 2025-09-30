-- Update the cost code parent trigger to support new hierarchical structure
-- Dynamic Groups: 1.0, 2.0, 3.0 (parent all codes starting with that prefix)
-- Dynamic Parents: 1.09, 2.01, etc. (parent all category variants)
-- Children: 1.09-labor, 1.09-material, 1.09-equipment (actual cost codes)

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
    
    -- Case 1: Child code pattern (e.g., 1.09-labor, 1.09-material) -> parent to 1.09
    IF NEW.code ~ '^\d+\.\d+-[a-zA-Z]+' THEN
      -- Extract parent code (everything before the dash)
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
      
    -- Case 2: Parent code pattern (e.g., 1.09, 2.01) -> parent to dynamic group (1.0, 2.0)
    ELSIF NEW.code ~ '^\d+\.\d+$' AND NEW.code !~ '^\d+\.0$' THEN
      -- Extract group code (first digit + .0)
      parent_code_text := substring(NEW.code from '^(\d+)') || '.0';
      
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

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_set_cost_code_parent ON public.cost_codes;
CREATE TRIGGER trigger_set_cost_code_parent
  BEFORE INSERT ON public.cost_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_cost_code_parent();

-- Update comments to reflect new structure
COMMENT ON COLUMN public.cost_codes.is_dynamic_group IS 'True for top-level dynamic groups (e.g., "1.0", "2.0") that parent all codes with that prefix';
COMMENT ON COLUMN public.cost_codes.parent_cost_code_id IS 'Links child codes to parent. E.g., 1.09-labor -> 1.09 -> 1.0';