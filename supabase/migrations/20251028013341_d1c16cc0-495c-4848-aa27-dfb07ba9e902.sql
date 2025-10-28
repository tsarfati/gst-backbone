-- Allow credit card as a valid payment method and prevent auto-posting JEs for credit card payments

-- 1) Update payments.payment_method CHECK constraint to include 'credit_card'
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_payment_method_check;

ALTER TABLE public.payments
  ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method = ANY (ARRAY['check'::text, 'ach'::text, 'wire'::text, 'cash'::text, 'credit_card'::text]));

-- 2) Update trigger function to skip JE posting for credit card payments
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
  -- Only handle INSERTs; ignore UPDATE to avoid recursion
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Do not post for voided/cancelled payments
  IF COALESCE(NEW.status, 'paid') = 'voided' THEN
    RETURN NEW;
  END IF;

  -- NEW: Skip auto-posting for credit card payments (handled in app-specific flow)
  IF NEW.payment_method = 'credit_card' THEN
    RETURN NEW;
  END IF;

  -- Get company_id from vendor
  IF NEW.vendor_id IS NOT NULL THEN
    SELECT v.company_id INTO payment_company_id
    FROM public.vendors v
    WHERE v.id = NEW.vendor_id;
  END IF;

  -- Load bank account context if available
  IF NEW.bank_account_id IS NOT NULL THEN
    SELECT b.chart_account_id, b.company_id, b.bank_fee_account_id
      INTO ba_chart_account_id, ba_company_id, bank_fee_account_id_var
    FROM public.bank_accounts AS b
    WHERE b.id = NEW.bank_account_id;

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
        AND (account_category = 'cash_accounts' OR account_category = 'bank_accounts')
        AND is_active = true
      ORDER BY is_system_account DESC, created_at ASC LIMIT 1)
  );

  -- IMPROVED: Find AP account with better logic
  -- Look for: current_liabilities category OR account numbers starting with '20' OR exact '2000'
  ap_account_id := (
    SELECT id FROM public.chart_of_accounts 
    WHERE company_id = payment_company_id 
      AND is_active = true
      AND (
        account_category IN ('accounts_payable', 'current_liabilities')
        OR account_number = '2000'
        OR account_number LIKE '20%'
      )
      AND (
        account_name ILIKE '%payable%'
        OR account_number IN ('2000', '20100', '20000')
      )
    ORDER BY 
      CASE WHEN account_category = 'accounts_payable' THEN 1
           WHEN account_number = '2000' THEN 2
           WHEN account_number = '20100' THEN 3
           ELSE 4 END,
      is_system_account DESC, 
      created_at ASC
    LIMIT 1
  );

  -- If required accounts are missing, skip posting but allow payment creation
  IF cash_account_id IS NULL OR ap_account_id IS NULL THEN
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

  -- Back-reference JE on payment
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