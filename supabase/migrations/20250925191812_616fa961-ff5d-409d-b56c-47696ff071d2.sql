-- Enhance Chart of Accounts for dual-entry accounting
ALTER TABLE public.chart_of_accounts 
ADD COLUMN IF NOT EXISTS account_category text,
ADD COLUMN IF NOT EXISTS normal_balance text CHECK (normal_balance IN ('debit', 'credit')),
ADD COLUMN IF NOT EXISTS current_balance numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_system_account boolean DEFAULT false;

-- Update account types to be more specific
ALTER TABLE public.chart_of_accounts 
DROP CONSTRAINT IF EXISTS chart_of_accounts_account_type_check;

ALTER TABLE public.chart_of_accounts 
ADD CONSTRAINT chart_of_accounts_account_type_check 
CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense', 'cost_of_goods_sold'));

-- Add job costing fields to journal entry lines
ALTER TABLE public.journal_entry_lines
ADD COLUMN IF NOT EXISTS billable boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS markup_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS billable_amount numeric DEFAULT 0;

-- Create function to validate journal entry balance
CREATE OR REPLACE FUNCTION public.validate_journal_entry_balance()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger to validate balance on journal entry line changes
DROP TRIGGER IF EXISTS validate_journal_balance_trigger ON public.journal_entry_lines;
CREATE TRIGGER validate_journal_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION public.validate_journal_entry_balance();

-- Create function to update account balances
CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger to update account balances
DROP TRIGGER IF EXISTS update_account_balance_trigger ON public.journal_entry_lines;
CREATE TRIGGER update_account_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_entry_lines
  FOR EACH ROW EXECUTE FUNCTION public.update_account_balance();

-- Create job cost summary view
CREATE OR REPLACE VIEW public.job_cost_summary AS
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

-- Insert default chart of accounts for construction company
INSERT INTO public.chart_of_accounts (account_number, account_name, account_type, account_category, normal_balance, is_system_account, created_by)
SELECT * FROM (VALUES
  ('1000', 'Cash - Operating', 'asset', 'current_assets', 'debit', true, auth.uid()),
  ('1100', 'Accounts Receivable', 'asset', 'current_assets', 'debit', true, auth.uid()),
  ('1200', 'Inventory - Materials', 'asset', 'current_assets', 'debit', true, auth.uid()),
  ('1300', 'Prepaid Expenses', 'asset', 'current_assets', 'debit', true, auth.uid()),
  ('1500', 'Equipment', 'asset', 'fixed_assets', 'debit', true, auth.uid()),
  ('1600', 'Accumulated Depreciation - Equipment', 'asset', 'fixed_assets', 'credit', true, auth.uid()),
  ('2000', 'Accounts Payable', 'liability', 'current_liabilities', 'credit', true, auth.uid()),
  ('2100', 'Accrued Payroll', 'liability', 'current_liabilities', 'credit', true, auth.uid()),
  ('2200', 'Sales Tax Payable', 'liability', 'current_liabilities', 'credit', true, auth.uid()),
  ('3000', 'Owner Equity', 'equity', 'equity', 'credit', true, auth.uid()),
  ('3100', 'Retained Earnings', 'equity', 'equity', 'credit', true, auth.uid()),
  ('4000', 'Construction Revenue', 'revenue', 'operating_revenue', 'credit', true, auth.uid()),
  ('5000', 'Direct Labor', 'cost_of_goods_sold', 'direct_costs', 'debit', true, auth.uid()),
  ('5100', 'Direct Materials', 'cost_of_goods_sold', 'direct_costs', 'debit', true, auth.uid()),
  ('5200', 'Subcontractor Costs', 'cost_of_goods_sold', 'direct_costs', 'debit', true, auth.uid()),
  ('5300', 'Equipment Costs', 'cost_of_goods_sold', 'direct_costs', 'debit', true, auth.uid()),
  ('6000', 'Office Salaries', 'expense', 'operating_expenses', 'debit', true, auth.uid()),
  ('6100', 'Office Rent', 'expense', 'operating_expenses', 'debit', true, auth.uid()),
  ('6200', 'Insurance', 'expense', 'operating_expenses', 'debit', true, auth.uid()),
  ('6300', 'Professional Fees', 'expense', 'operating_expenses', 'debit', true, auth.uid())
) AS default_accounts(account_number, account_name, account_type, account_category, normal_balance, is_system_account, created_by)
WHERE auth.uid() IS NOT NULL
ON CONFLICT (account_number) DO NOTHING;

-- Create function to automatically create journal entries for invoices
CREATE OR REPLACE FUNCTION public.create_invoice_journal_entry()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger for invoice journal entries
DROP TRIGGER IF EXISTS create_invoice_journal_entry_trigger ON public.invoices;
CREATE TRIGGER create_invoice_journal_entry_trigger
  AFTER UPDATE ON public.invoices
  FOR EACH ROW 
  WHEN (OLD.status != NEW.status AND NEW.status IN ('pending_payment', 'paid'))
  EXECUTE FUNCTION public.create_invoice_journal_entry();

-- Create function to handle payment journal entries
CREATE OR REPLACE FUNCTION public.create_payment_journal_entry()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger for payment journal entries
DROP TRIGGER IF EXISTS create_payment_journal_entry_trigger ON public.payments;
CREATE TRIGGER create_payment_journal_entry_trigger
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.create_payment_journal_entry();