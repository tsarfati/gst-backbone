-- Fix function search path security issues
CREATE OR REPLACE FUNCTION public.validate_journal_entry_balance()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if debits equal credits for the journal entry
  IF (SELECT 
        COALESCE(SUM(debit_amount), 0) - COALESCE(SUM(credit_amount), 0)
      FROM public.journal_entry_lines 
      WHERE journal_entry_id = NEW.journal_entry_id) != 0 THEN
    RAISE EXCEPTION 'Journal entry debits must equal credits';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  account_normal_balance text;
BEGIN
  -- Get the account's normal balance
  SELECT normal_balance INTO account_normal_balance
  FROM public.chart_of_accounts
  WHERE id = COALESCE(NEW.account_id, OLD.account_id);
  
  -- Update account balance based on normal balance type
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.chart_of_accounts
    SET current_balance = current_balance + 
      CASE 
        WHEN account_normal_balance = 'debit' THEN 
          COALESCE(NEW.debit_amount, 0) - COALESCE(NEW.credit_amount, 0)
        ELSE 
          COALESCE(NEW.credit_amount, 0) - COALESCE(NEW.debit_amount, 0)
      END
    WHERE id = NEW.account_id;
  END IF;
  
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    UPDATE public.chart_of_accounts
    SET current_balance = current_balance - 
      CASE 
        WHEN account_normal_balance = 'debit' THEN 
          COALESCE(OLD.debit_amount, 0) - COALESCE(OLD.credit_amount, 0)
        ELSE 
          COALESCE(OLD.credit_amount, 0) - COALESCE(OLD.debit_amount, 0)
      END
    WHERE id = OLD.account_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_invoice_journal_entry()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ar_account_id uuid;
  revenue_account_id uuid;
  entry_id uuid;
BEGIN
  -- Only create journal entry when invoice is approved/pending_payment
  IF NEW.status NOT IN ('pending_payment', 'paid') THEN
    RETURN NEW;
  END IF;
  
  -- Get account IDs
  SELECT id INTO ar_account_id FROM public.chart_of_accounts WHERE account_number = '1100' LIMIT 1;
  SELECT id INTO revenue_account_id FROM public.chart_of_accounts WHERE account_number = '4000' LIMIT 1;
  
  IF ar_account_id IS NULL OR revenue_account_id IS NULL THEN
    RAISE EXCEPTION 'Required accounts not found in chart of accounts';
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

CREATE OR REPLACE FUNCTION public.create_payment_journal_entry()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cash_account_id uuid;
  ap_account_id uuid;
  entry_id uuid;
BEGIN
  -- Only process when payment is created or status changes to completed
  IF (TG_OP = 'INSERT' AND NEW.status = 'draft') OR 
     (TG_OP = 'UPDATE' AND NEW.status != 'completed') THEN
    RETURN NEW;
  END IF;
  
  -- Get account IDs
  SELECT id INTO cash_account_id FROM public.chart_of_accounts WHERE account_number = '1000' LIMIT 1;
  SELECT id INTO ap_account_id FROM public.chart_of_accounts WHERE account_number = '2000' LIMIT 1;
  
  IF cash_account_id IS NULL OR ap_account_id IS NULL THEN
    RAISE EXCEPTION 'Required accounts not found in chart of accounts';
  END IF;
  
  -- Create journal entry
  INSERT INTO public.journal_entries (
    description,
    entry_date,
    reference,
    total_debit,
    total_credit,
    created_by,
    status
  ) VALUES (
    'Payment ' || NEW.payment_number,
    NEW.payment_date,
    'PAY-' || NEW.id,
    NEW.amount,
    NEW.amount,
    NEW.created_by,
    'posted'
  ) RETURNING id INTO entry_id;
  
  -- Update payment with journal entry reference
  UPDATE public.payments SET journal_entry_id = entry_id WHERE id = NEW.id;
  
  -- Debit Accounts Payable
  INSERT INTO public.journal_entry_lines (
    journal_entry_id,
    account_id,
    debit_amount,
    credit_amount,
    description,
    line_order
  ) VALUES (
    entry_id,
    ap_account_id,
    NEW.amount,
    0,
    'Payment to vendor',
    1
  );
  
  -- Credit Cash
  INSERT INTO public.journal_entry_lines (
    journal_entry_id,
    account_id,
    debit_amount,
    credit_amount,
    description,
    line_order
  ) VALUES (
    entry_id,
    cash_account_id,
    0,
    NEW.amount,
    'Cash payment',
    2
  );
  
  RETURN NEW;
END;
$$;

-- Remove the security definer view and recreate as regular view
DROP VIEW IF EXISTS public.job_cost_summary;

-- Create regular view without security definer
CREATE VIEW public.job_cost_summary AS
SELECT 
  j.id as job_id,
  j.name as job_name,
  cc.id as cost_code_id,
  cc.code as cost_code,
  cc.description as cost_code_description,
  SUM(CASE 
    WHEN ca.account_type IN ('expense', 'cost_of_goods_sold') THEN 
      jel.debit_amount - jel.credit_amount
    ELSE 0
  END) as total_cost,
  SUM(CASE 
    WHEN jel.billable = true THEN jel.billable_amount
    ELSE 0
  END) as total_billable,
  COUNT(jel.id) as transaction_count
FROM public.jobs j
LEFT JOIN public.cost_codes cc ON cc.job_id = j.id
LEFT JOIN public.journal_entry_lines jel ON jel.job_id = j.id AND jel.cost_code_id = cc.id
LEFT JOIN public.chart_of_accounts ca ON ca.id = jel.account_id
LEFT JOIN public.journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
GROUP BY j.id, j.name, cc.id, cc.code, cc.description;