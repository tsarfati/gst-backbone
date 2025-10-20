-- Align JE trigger to 'cleared' status
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
  bank_account_data record;
BEGIN
  -- Only post journal entries when payment is cleared
  IF (TG_OP = 'INSERT' AND NEW.status <> 'cleared') OR (TG_OP = 'UPDATE' AND NEW.status <> 'cleared') THEN
    RETURN NEW;
  END IF;

  -- Get account IDs
  SELECT id INTO cash_account_id FROM public.chart_of_accounts WHERE account_number = '1000' LIMIT 1;
  SELECT id INTO ap_account_id FROM public.chart_of_accounts WHERE account_number = '2000' LIMIT 1;

  IF cash_account_id IS NULL OR ap_account_id IS NULL THEN
    RAISE EXCEPTION 'Required accounts not found in chart of accounts';
  END IF;

  -- Bank fee account (optional)
  IF NEW.bank_account_id IS NOT NULL THEN
    SELECT ba.bank_fee_account_id INTO bank_account_data
    FROM public.bank_accounts ba
    WHERE ba.id = NEW.bank_account_id;
    bank_fee_account_id := bank_account_data.bank_fee_account_id;
  END IF;

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