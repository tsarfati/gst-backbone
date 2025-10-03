-- Check and drop the old constraint if it exists (without checking new one)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'cost_codes_job_id_code_key'
  ) THEN
    ALTER TABLE public.cost_codes DROP CONSTRAINT cost_codes_job_id_code_key;
  END IF;
END $$;