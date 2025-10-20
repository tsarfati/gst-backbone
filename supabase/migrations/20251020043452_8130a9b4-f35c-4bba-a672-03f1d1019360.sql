-- Robust payment JE function using bank account's linked cash account and company AP account
CREATE OR REPLACE FUNCTION public.create_payment_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cash_account_id uuid;
  ap_account_id uuid;
  bank_fee_account_id uuid;
  entry_id uuid;
  ba record;
BEGIN
  -- Only post journal entries when payment is cleared
  IF (TG_OP = 'INSERT' AND NEW.status <> 'cleared') OR (TG_OP = 'UPDATE' AND NEW.status <> 'cleared') THEN
    RETURN NEW;
  END IF;

  -- Load bank account context
  IF NEW.bank_account_id IS NOT NULL THEN
    SELECT chart_account_id, company_id, bank_fee_account_id
    INTO ba
    FROM public.bank_accounts
    WHERE id = NEW.bank_account_id;
  END IF;

  -- Determine cash account: prefer the bank account's linked chart account
  cash_account_id := COALESCE(
    ba.chart_account_id,
    (SELECT id FROM public.chart_of_accounts 
      WHERE company_id = ba.company_id 
        AND account_category = 'cash_accounts' 
        AND is_active = true
      ORDER BY is_system_account DESC, created_at ASC LIMIT 1)
  );

  -- Determine AP account for the same company
  ap_account_id := (
    SELECT id FROM public.chart_of_accounts 
    WHERE company_id = ba.company_id 
      AND (account_category = 'accounts_payable' OR account_number = '2000')
    ORDER BY is_system_account DESC, created_at ASC
    LIMIT 1
  );

  IF cash_account_id IS NULL THEN
    RAISE EXCEPTION 'Cash account not configured for this bank account/company';
  END IF;
  IF ap_account_id IS NULL THEN
    RAISE EXCEPTION 'Accounts Payable account not configured for this company';
  END IF;

  bank_fee_account_id := ba.bank_fee_account_id; -- optional

  -- Create journal entry (include bank fee)
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
    NEW.amount + COALESCE(NEW.bank_fee, 0),
    NEW.amount + COALESCE(NEW.bank_fee, 0),
    NEW.created_by,
    'posted'
  ) RETURNING id INTO entry_id;

  -- Back-reference JE on payment
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

  -- Bank fee (optional)
  IF COALESCE(NEW.bank_fee, 0) > 0 AND bank_fee_account_id IS NOT NULL THEN
    -- Debit Bank Fees (expense)
    INSERT INTO public.journal_entry_lines (
      journal_entry_id,
      account_id,
      debit_amount,
      credit_amount,
      description,
      line_order
    ) VALUES (
      entry_id,
      bank_fee_account_id,
      NEW.bank_fee,
      0,
      'Bank fee for ' || NEW.payment_method,
      3
    );

    -- Credit Cash for the fee
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
      NEW.bank_fee,
      'Bank fee deducted',
      4
    );
  END IF;

  RETURN NEW;
END;
$function$;