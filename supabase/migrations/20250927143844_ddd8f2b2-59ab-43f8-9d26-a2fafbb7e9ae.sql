-- Add chart_of_accounts relationship to cost_codes table
ALTER TABLE public.cost_codes 
ADD COLUMN chart_account_id uuid REFERENCES public.chart_of_accounts(id);

-- Create index for performance
CREATE INDEX idx_cost_codes_chart_account ON public.cost_codes(chart_account_id);

-- Update cost_codes to include chart account number for easier reference
ALTER TABLE public.cost_codes
ADD COLUMN chart_account_number text;