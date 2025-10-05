-- Add cost code selection timing setting to punch_clock_settings table
ALTER TABLE public.punch_clock_settings 
ADD COLUMN IF NOT EXISTS cost_code_selection_timing text DEFAULT 'punch_in' CHECK (cost_code_selection_timing IN ('punch_in', 'punch_out'));