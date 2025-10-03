-- Drop the existing constraint that only checks job_id and code
ALTER TABLE public.cost_codes 
DROP CONSTRAINT IF EXISTS cost_codes_job_id_code_key;

-- Add a new constraint that includes type, allowing multiple types for the same code
ALTER TABLE public.cost_codes 
ADD CONSTRAINT cost_codes_job_id_code_type_key 
UNIQUE (job_id, code, type);