-- Create credit_card_transactions table for CSV imports
CREATE TABLE IF NOT EXISTS public.credit_card_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  transaction_date DATE NOT NULL,
  post_date DATE,
  description TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  transaction_type TEXT CHECK (transaction_type IN ('debit', 'credit')),
  category TEXT,
  merchant_name TEXT,
  reference_number TEXT,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  receipt_id UUID,
  is_reconciled BOOLEAN DEFAULT false,
  notes TEXT,
  imported_from_csv BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Create index for faster lookups
CREATE INDEX idx_credit_card_transactions_card_id ON public.credit_card_transactions(credit_card_id);
CREATE INDEX idx_credit_card_transactions_company_id ON public.credit_card_transactions(company_id);
CREATE INDEX idx_credit_card_transactions_date ON public.credit_card_transactions(transaction_date);
CREATE INDEX idx_credit_card_transactions_invoice_id ON public.credit_card_transactions(invoice_id);

-- Enable RLS
ALTER TABLE public.credit_card_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view credit card transactions for their companies"
  ON public.credit_card_transactions
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM get_user_companies(auth.uid())
    )
  );

CREATE POLICY "Admins and controllers can manage credit card transactions"
  ON public.credit_card_transactions
  FOR ALL
  USING (
    company_id IN (
      SELECT uc.company_id 
      FROM get_user_companies(auth.uid()) uc
      WHERE uc.role IN ('admin', 'controller')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT uc.company_id 
      FROM get_user_companies(auth.uid()) uc
      WHERE uc.role IN ('admin', 'controller')
    )
  );

-- Update trigger for updated_at
CREATE TRIGGER update_credit_card_transactions_updated_at
  BEFORE UPDATE ON public.credit_card_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add CSV import tracking to credit_cards table
ALTER TABLE public.credit_cards
ADD COLUMN IF NOT EXISTS last_csv_import_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_csv_import_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS csv_import_count INTEGER DEFAULT 0;