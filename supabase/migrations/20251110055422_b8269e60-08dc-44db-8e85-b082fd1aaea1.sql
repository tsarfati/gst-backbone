-- Create table for credit card transaction cost distributions
CREATE TABLE public.credit_card_transaction_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.credit_card_transactions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  cost_code_id UUID REFERENCES public.cost_codes(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  percentage NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to maintain updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_update_cc_txn_distributions ON public.credit_card_transaction_distributions;
CREATE TRIGGER trg_update_cc_txn_distributions
BEFORE UPDATE ON public.credit_card_transaction_distributions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_cc_txn_dist_transaction_id ON public.credit_card_transaction_distributions(transaction_id);
CREATE INDEX idx_cc_txn_dist_company_id ON public.credit_card_transaction_distributions(company_id);

-- Enable RLS
ALTER TABLE public.credit_card_transaction_distributions ENABLE ROW LEVEL SECURITY;

-- Policies: company members can manage rows for their company
CREATE POLICY "cc_dist_select_company"
ON public.credit_card_transaction_distributions
FOR SELECT
TO authenticated
USING (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "cc_dist_insert_company"
ON public.credit_card_transaction_distributions
FOR INSERT
TO authenticated
WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "cc_dist_update_company"
ON public.credit_card_transaction_distributions
FOR UPDATE
TO authenticated
USING (public.has_company_access(auth.uid(), company_id))
WITH CHECK (public.has_company_access(auth.uid(), company_id));

CREATE POLICY "cc_dist_delete_company"
ON public.credit_card_transaction_distributions
FOR DELETE
TO authenticated
USING (public.has_company_access(auth.uid(), company_id));