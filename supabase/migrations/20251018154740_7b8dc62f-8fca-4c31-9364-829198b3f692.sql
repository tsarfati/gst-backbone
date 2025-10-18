-- Create receipt_cost_distributions table for handling receipts split across multiple job/cost codes
CREATE TABLE IF NOT EXISTS public.receipt_cost_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE RESTRICT,
  cost_code_id UUID NOT NULL REFERENCES public.cost_codes(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  percentage NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  CONSTRAINT valid_percentage CHECK (percentage >= 0 AND percentage <= 100)
);

-- Enable RLS
ALTER TABLE public.receipt_cost_distributions ENABLE ROW LEVEL SECURITY;

-- Users can view receipt cost distributions for their company receipts
CREATE POLICY "Users can view receipt cost distributions for their company"
ON public.receipt_cost_distributions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.receipts r
    JOIN get_user_companies(auth.uid()) uc ON uc.company_id = r.company_id
    WHERE r.id = receipt_cost_distributions.receipt_id
  )
);

-- Users can create receipt cost distributions for their company receipts
CREATE POLICY "Users can create receipt cost distributions for their company"
ON public.receipt_cost_distributions FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1 FROM public.receipts r
    JOIN get_user_companies(auth.uid()) uc ON uc.company_id = r.company_id
    WHERE r.id = receipt_cost_distributions.receipt_id
  )
);

-- Users can update receipt cost distributions for their company receipts
CREATE POLICY "Users can update receipt cost distributions for their company"
ON public.receipt_cost_distributions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.receipts r
    JOIN get_user_companies(auth.uid()) uc ON uc.company_id = r.company_id
    WHERE r.id = receipt_cost_distributions.receipt_id
  )
);

-- Users can delete receipt cost distributions for their company receipts
CREATE POLICY "Users can delete receipt cost distributions for their company"
ON public.receipt_cost_distributions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.receipts r
    JOIN get_user_companies(auth.uid()) uc ON uc.company_id = r.company_id
    WHERE r.id = receipt_cost_distributions.receipt_id
  )
);

-- Add index for better query performance
CREATE INDEX idx_receipt_cost_distributions_receipt_id ON public.receipt_cost_distributions(receipt_id);
CREATE INDEX idx_receipt_cost_distributions_job_id ON public.receipt_cost_distributions(job_id);
CREATE INDEX idx_receipt_cost_distributions_cost_code_id ON public.receipt_cost_distributions(cost_code_id);

-- Add trigger to update updated_at
CREATE TRIGGER update_receipt_cost_distributions_updated_at
  BEFORE UPDATE ON public.receipt_cost_distributions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();