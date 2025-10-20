-- Fix payments RLS policies to use company context instead of auth.uid()
DROP POLICY IF EXISTS "Users can view payments for their company vendors" ON public.payments;
DROP POLICY IF EXISTS "Users can view payment invoice lines for their company" ON public.payment_invoice_lines;

-- Create correct RLS policy for payments
CREATE POLICY "Users can view payments for their company vendors"
ON public.payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM vendors v
    INNER JOIN get_user_companies(auth.uid()) uc ON uc.company_id = v.company_id
    WHERE v.id = payments.vendor_id
  )
);

-- Create correct RLS policy for payment_invoice_lines
CREATE POLICY "Users can view payment invoice lines for their company"
ON public.payment_invoice_lines
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM payments p
    INNER JOIN vendors v ON v.id = p.vendor_id
    INNER JOIN get_user_companies(auth.uid()) uc ON uc.company_id = v.company_id
    WHERE p.id = payment_invoice_lines.payment_id
  )
);

-- Fix create_invoice_journal_entry to not fail when accounts don't exist
-- Instead, just skip journal entry creation if accounts are missing
CREATE OR REPLACE FUNCTION public.create_invoice_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  ar_account_id uuid;
  revenue_account_id uuid;
  entry_id uuid;
  invoice_company_id uuid;
BEGIN
  -- Only create journal entry when invoice is approved/pending_payment
  IF NEW.status NOT IN ('pending_payment', 'paid') THEN
    RETURN NEW;
  END IF;
  
  -- Get the company_id from the invoice's vendor
  SELECT v.company_id INTO invoice_company_id
  FROM vendors v
  WHERE v.id = NEW.vendor_id;
  
  -- Get account IDs for this company
  SELECT id INTO ar_account_id 
  FROM public.chart_of_accounts 
  WHERE company_id = invoice_company_id 
    AND account_number = '1100' 
  LIMIT 1;
    
  SELECT id INTO revenue_account_id 
  FROM public.chart_of_accounts 
  WHERE company_id = invoice_company_id 
    AND account_number = '4000' 
  LIMIT 1;
  
  -- Skip journal entry creation if accounts don't exist (instead of raising error)
  IF ar_account_id IS NULL OR revenue_account_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Create journal entry
  INSERT INTO public.journal_entries (
    description, 
    entry_date, 
    reference,
    total_debit,
    total_credit,
    created_by,
    job_id
  ) VALUES (
    'Invoice ' || COALESCE(NEW.invoice_number, NEW.id::text),
    COALESCE(NEW.issue_date, CURRENT_DATE),
    'INV-' || NEW.id,
    NEW.amount,
    NEW.amount,
    NEW.created_by,
    NEW.job_id
  ) RETURNING id INTO entry_id;
  
  -- Create journal entry lines
  -- Debit Accounts Receivable
  INSERT INTO public.journal_entry_lines (
    journal_entry_id,
    account_id,
    debit_amount,
    credit_amount,
    description,
    job_id,
    cost_code_id,
    line_order
  ) VALUES (
    entry_id,
    ar_account_id,
    NEW.amount,
    0,
    'Invoice ' || COALESCE(NEW.invoice_number, NEW.id::text),
    NEW.job_id,
    NEW.cost_code_id,
    1
  );
  
  -- Credit Revenue
  INSERT INTO public.journal_entry_lines (
    journal_entry_id,
    account_id,
    debit_amount,
    credit_amount,
    description,
    job_id,
    cost_code_id,
    line_order,
    billable,
    billable_amount
  ) VALUES (
    entry_id,
    revenue_account_id,
    0,
    NEW.amount,
    'Invoice ' || COALESCE(NEW.invoice_number, NEW.id::text),
    NEW.job_id,
    NEW.cost_code_id,
    2,
    true,
    NEW.amount
  );
  
  RETURN NEW;
END;
$$;