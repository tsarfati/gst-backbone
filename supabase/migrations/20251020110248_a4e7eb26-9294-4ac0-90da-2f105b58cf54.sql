-- Create bank reconciliations table
CREATE TABLE IF NOT EXISTS public.bank_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  beginning_balance NUMERIC NOT NULL,
  ending_balance NUMERIC NOT NULL,
  beginning_date DATE NOT NULL,
  ending_date DATE NOT NULL,
  cleared_balance NUMERIC DEFAULT 0,
  adjusted_balance NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress',
  reconciled_by UUID REFERENCES auth.users(id),
  reconciled_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Create bank reconciliation items table (tracks which transactions were cleared)
CREATE TABLE IF NOT EXISTS public.bank_reconciliation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reconciliation_id UUID NOT NULL REFERENCES public.bank_reconciliations(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL, -- 'payment', 'deposit', 'journal_entry'
  transaction_id UUID NOT NULL,
  amount NUMERIC NOT NULL,
  is_cleared BOOLEAN NOT NULL DEFAULT false,
  cleared_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_reconciliation_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for bank_reconciliations
CREATE POLICY "Users can view reconciliations for their companies"
  ON public.bank_reconciliations FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM get_user_companies(auth.uid())
  ));

CREATE POLICY "Admins and controllers can manage reconciliations"
  ON public.bank_reconciliations FOR ALL
  USING (company_id IN (
    SELECT company_id FROM get_user_companies(auth.uid())
    WHERE role IN ('admin', 'controller')
  ))
  WITH CHECK (company_id IN (
    SELECT company_id FROM get_user_companies(auth.uid())
    WHERE role IN ('admin', 'controller')
  ));

-- RLS policies for bank_reconciliation_items
CREATE POLICY "Users can view reconciliation items for their companies"
  ON public.bank_reconciliation_items FOR SELECT
  USING (reconciliation_id IN (
    SELECT id FROM public.bank_reconciliations
    WHERE company_id IN (
      SELECT company_id FROM get_user_companies(auth.uid())
    )
  ));

CREATE POLICY "Admins and controllers can manage reconciliation items"
  ON public.bank_reconciliation_items FOR ALL
  USING (reconciliation_id IN (
    SELECT id FROM public.bank_reconciliations
    WHERE company_id IN (
      SELECT company_id FROM get_user_companies(auth.uid())
      WHERE role IN ('admin', 'controller')
    )
  ))
  WITH CHECK (reconciliation_id IN (
    SELECT id FROM public.bank_reconciliations
    WHERE company_id IN (
      SELECT company_id FROM get_user_companies(auth.uid())
      WHERE role IN ('admin', 'controller')
    )
  ));

-- Add indexes for better performance
CREATE INDEX idx_bank_reconciliations_bank_account ON public.bank_reconciliations(bank_account_id);
CREATE INDEX idx_bank_reconciliations_company ON public.bank_reconciliations(company_id);
CREATE INDEX idx_bank_reconciliations_status ON public.bank_reconciliations(status);
CREATE INDEX idx_bank_reconciliation_items_reconciliation ON public.bank_reconciliation_items(reconciliation_id);
CREATE INDEX idx_bank_reconciliation_items_transaction ON public.bank_reconciliation_items(transaction_id, transaction_type);