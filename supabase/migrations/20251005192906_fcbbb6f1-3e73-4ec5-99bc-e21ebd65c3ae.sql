-- Remove cost_code_selection_timing from wrong table (if it exists)
ALTER TABLE IF EXISTS public.punch_clock_settings 
DROP COLUMN IF EXISTS cost_code_selection_timing;

-- Add cost_code_selection_timing to correct table
ALTER TABLE public.job_punch_clock_settings 
ADD COLUMN IF NOT EXISTS cost_code_selection_timing text DEFAULT 'punch_in' CHECK (cost_code_selection_timing IN ('punch_in', 'punch_out'));