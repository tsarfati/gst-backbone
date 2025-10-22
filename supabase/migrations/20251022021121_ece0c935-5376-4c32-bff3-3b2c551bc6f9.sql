-- Backfill journal entries for existing payments missing JE (one-time)
DO $$
DECLARE 
  p RECORD;
  cash uuid;
  ap uuid;
  fee uuid;
  je uuid;
  payco uuid;
  ba RECORD;
BEGIN
  FOR p IN 
    SELECT * FROM public.payments 
    WHERE journal_entry_id IS NULL 
      AND COALESCE(status,'paid') <> 'voided'
  LOOP
    cash := NULL; ap := NULL; fee := NULL; je := NULL; payco := NULL; ba := NULL;

    -- Determine company from bank account, invoice, or vendor
    IF p.bank_account_id IS NOT NULL THEN
      SELECT chart_account_id, company_id, bank_fee_account_id INTO ba FROM public.bank_accounts WHERE id = p.bank_account_id;
      payco := ba.company_id;
      cash := ba.chart_account_id;
      fee := ba.bank_fee_account_id;
    END IF;

    IF payco IS NULL AND p.invoice_id IS NOT NULL THEN
      SELECT v.company_id INTO payco FROM public.invoices i JOIN public.vendors v ON v.id = i.vendor_id WHERE i.id = p.invoice_id;
    END IF;

    IF payco IS NULL AND p.vendor_id IS NOT NULL THEN
      SELECT company_id INTO payco FROM public.vendors WHERE id = p.vendor_id;
    END IF;

    IF payco IS NULL THEN
      CONTINUE; -- skip if we can't resolve company
    END IF;

    IF cash IS NULL THEN
      SELECT id INTO cash FROM public.chart_of_accounts 
        WHERE company_id = payco 
          AND account_category = 'cash_accounts' 
          AND is_active = true
        ORDER BY is_system_account DESC, created_at ASC LIMIT 1;
    END IF;

    SELECT id INTO ap FROM public.chart_of_accounts 
      WHERE company_id = payco 
        AND (account_category = 'accounts_payable' OR account_number = '2000')
      ORDER BY is_system_account DESC, created_at ASC LIMIT 1;

    IF cash IS NULL OR ap IS NULL THEN
      CONTINUE; -- cannot post without accounts
    END IF;

    -- Create journal entry
    INSERT INTO public.journal_entries (
      description, entry_date, reference, total_debit, total_credit, created_by, status, company_id
    ) VALUES (
      'Payment ' || COALESCE(p.payment_number, ''),
      p.payment_date,
      'PAY-' || p.id,
      p.amount + COALESCE(p.bank_fee, 0),
      p.amount + COALESCE(p.bank_fee, 0),
      p.created_by,
      'posted',
      payco
    ) RETURNING id INTO je;

    UPDATE public.payments SET journal_entry_id = je WHERE id = p.id;

    -- Debit AP
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description, line_order)
    VALUES (je, ap, p.amount, 0, 'Payment to vendor', 1);

    -- Credit cash
    INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description, line_order)
    VALUES (je, cash, 0, p.amount, 'Cash payment', 2);

    -- Bank fee if any
    IF COALESCE(p.bank_fee, 0) > 0 AND fee IS NOT NULL THEN
      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description, line_order)
      VALUES (je, fee, p.bank_fee, 0, 'Bank fee for ' || COALESCE(p.payment_method,'payment'), 3);

      INSERT INTO public.journal_entry_lines (journal_entry_id, account_id, debit_amount, credit_amount, description, line_order)
      VALUES (je, cash, 0, p.bank_fee, 'Bank fee deducted', 4);
    END IF;
  END LOOP;
END $$;

-- Recompute balances again after backfill
DO $$
DECLARE rec RECORD;
BEGIN
  FOR rec IN SELECT id FROM public.chart_of_accounts LOOP
    PERFORM public.recalculate_account_balance(rec.id);
  END LOOP;
END $$;