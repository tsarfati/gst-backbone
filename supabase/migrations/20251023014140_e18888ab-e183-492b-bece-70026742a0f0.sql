-- Create credit card transaction communications table
CREATE TABLE IF NOT EXISTS public.credit_card_transaction_communications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID NOT NULL REFERENCES public.credit_card_transactions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_card_transaction_communications ENABLE ROW LEVEL SECURITY;

-- Users can view communications for transactions in their companies
CREATE POLICY "Users can view transaction communications for their companies"
ON public.credit_card_transaction_communications
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM get_user_companies(auth.uid())
  )
);

-- Users can create communications for transactions in their companies
CREATE POLICY "Users can create transaction communications"
ON public.credit_card_transaction_communications
FOR INSERT
WITH CHECK (
  user_id = auth.uid() AND
  company_id IN (
    SELECT company_id FROM get_user_companies(auth.uid())
  )
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_cc_transaction_communications_transaction_id 
ON public.credit_card_transaction_communications(transaction_id);

CREATE INDEX IF NOT EXISTS idx_cc_transaction_communications_company_id 
ON public.credit_card_transaction_communications(company_id);