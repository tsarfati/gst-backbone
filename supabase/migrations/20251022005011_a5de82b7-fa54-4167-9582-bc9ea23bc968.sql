-- Fix payment journal entry function to properly get company_id and create lines
CREATE OR REPLACE FUNCTION public.create_payment_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cash_account_id uuid;
  ap_account_id uuid;
  bank_fee_account_id_var uuid;
  entry_id uuid;
  ba_company_id uuid;
  ba_chart_account_id uuid;
  payment_company_id uuid;
BEGIN
  -- Only handle INSERTs; ignore UPDATE to avoid recursion from our own UPDATE
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Only post journal entries when payment is cleared
  IF NEW.status <> 'cleared' THEN
    RETURN NEW;
  END IF;

  -- Get company_id from the invoice linked to this payment
  IF NEW.invoice_id IS NOT NULL THEN
    SELECT v.company_id INTO payment_company_id
    FROM public.invoices i
    JOIN public.vendors v ON v.id = i.vendor_id
    WHERE i.id = NEW.invoice_id;
  END IF;

  -- Load bank account context if available
  IF NEW.bank_account_id IS NOT NULL THEN
    SELECT b.chart_account_id, b.company_id, b.bank_fee_account_id
      INTO ba_chart_account_id, ba_company_id, bank_fee_account_id_var
    FROM public.bank_accounts AS b
    WHERE b.id = NEW.bank_account_id;
    
    -- Use bank account company if available
    payment_company_id := COALESCE(ba_company_id, payment_company_id);
  END IF;

  -- If we still don't have a company_id, we can't proceed
  IF payment_company_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determine cash account
  cash_account_id := COALESCE(
    ba_chart_account_id,
    (SELECT id FROM public.chart_of_accounts 
      WHERE company_id = payment_company_id 
        AND account_category = 'cash_accounts' 
        AND is_active = true
      ORDER BY is_system_account DESC, created_at ASC LIMIT 1)
  );

  -- Determine AP account for the same company
  ap_account_id := (
    SELECT id FROM public.chart_of_accounts 
    WHERE company_id = payment_company_id 
      AND (account_category = 'accounts_payable' OR account_number = '2000')
    ORDER BY is_system_account DESC, created_at ASC
    LIMIT 1
  );

  -- If required accounts are missing, skip posting but allow payment creation
  IF cash_account_id IS NULL OR ap_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Create journal entry (include bank fee)
  INSERT INTO public.journal_entries (
    description,
    entry_date,
    reference,
    total_debit,
    total_credit,
    created_by,
    status,
    company_id
  ) VALUES (
    'Payment ' || NEW.payment_number,
    NEW.payment_date,
    'PAY-' || NEW.id,
    NEW.amount + COALESCE(NEW.bank_fee, 0),
    NEW.amount + COALESCE(NEW.bank_fee, 0),
    NEW.created_by,
    'posted',
    payment_company_id
  ) RETURNING id INTO entry_id;

  -- Back-reference JE on payment; this will fire UPDATE trigger but our function ignores UPDATE
  UPDATE public.payments SET journal_entry_id = entry_id WHERE id = NEW.id;

  -- Debit AP
  INSERT INTO public.journal_entry_lines (
    journal_entry_id, account_id, debit_amount, credit_amount, description, line_order
  ) VALUES (
    entry_id, ap_account_id, NEW.amount, 0, 'Payment to vendor', 1
  );

  -- Credit Cash
  INSERT INTO public.journal_entry_lines (
    journal_entry_id, account_id, debit_amount, credit_amount, description, line_order
  ) VALUES (
    entry_id, cash_account_id, 0, NEW.amount, 'Cash payment', 2
  );

  -- Optional bank fee
  IF COALESCE(NEW.bank_fee, 0) > 0 AND bank_fee_account_id_var IS NOT NULL THEN
    INSERT INTO public.journal_entry_lines (
      journal_entry_id, account_id, debit_amount, credit_amount, description, line_order
    ) VALUES (
      entry_id, bank_fee_account_id_var, NEW.bank_fee, 0, 'Bank fee for ' || NEW.payment_method, 3
    );

    INSERT INTO public.journal_entry_lines (
      journal_entry_id, account_id, debit_amount, credit_amount, description, line_order
    ) VALUES (
      entry_id, cash_account_id, 0, NEW.bank_fee, 'Bank fee deducted', 4
    );
  END IF;

  RETURN NEW;
END;
$function$;