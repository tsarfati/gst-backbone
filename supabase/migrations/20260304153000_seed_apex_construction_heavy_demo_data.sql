CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_company_id CONSTANT uuid := 'b2c3d4e5-f6a7-8901-bcde-f23456789012';
  v_demo_user_id CONSTANT uuid := '843e8c84-c08e-4b50-ba5d-0a6d1a4608d7';
  v_base_date date := CURRENT_DATE - 120;

  v_vendor_count int;
  v_job_count int;
  v_cost_code_count int;
  v_card_count int;
  v_bank_count int;

  v_ap_account_id uuid;
  v_revenue_account_id uuid;
  v_expense_account_id uuid;
  v_cc_liability_account_id uuid;

  j_rec record;
  b_rec record;
  p_rec record;

  v_vendor_id uuid;
  v_cost_code_id uuid;
  v_card_id uuid;
  v_bank_id uuid;
  v_rfp_id uuid;
  v_bid_id uuid;
  v_invoice_id uuid;
  v_cc_tx_id uuid;
  v_payment_id uuid;
  v_je_id uuid;
  v_amount numeric;
  v_statement_id uuid;
  v_reconciliation_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.companies
    WHERE id = v_company_id
  ) THEN
    RAISE NOTICE 'Apex demo company % not found; skipping heavy demo seed.', v_company_id;
    RETURN;
  END IF;

  -- Ensure baseline chart accounts used by payment/journal flows exist.
  IF NOT EXISTS (
    SELECT 1 FROM public.chart_of_accounts
    WHERE company_id = v_company_id AND account_number = '2000'
  ) THEN
    INSERT INTO public.chart_of_accounts (
      company_id, account_number, account_name, account_type, account_category,
      normal_balance, current_balance, is_system_account, created_by
    ) VALUES (
      v_company_id, '2000', 'Accounts Payable', 'liability', 'current_liabilities',
      'credit', 0, true, v_demo_user_id
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chart_of_accounts
    WHERE company_id = v_company_id AND account_number = '4000'
  ) THEN
    INSERT INTO public.chart_of_accounts (
      company_id, account_number, account_name, account_type, account_category,
      normal_balance, current_balance, is_system_account, created_by
    ) VALUES (
      v_company_id, '4000', 'Construction Revenue', 'revenue', 'operating_revenue',
      'credit', 0, true, v_demo_user_id
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chart_of_accounts
    WHERE company_id = v_company_id AND account_number = '5000'
  ) THEN
    INSERT INTO public.chart_of_accounts (
      company_id, account_number, account_name, account_type, account_category,
      normal_balance, current_balance, is_system_account, created_by
    ) VALUES (
      v_company_id, '5000', 'Construction Expenses', 'expense', 'operating_expenses',
      'debit', 0, true, v_demo_user_id
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chart_of_accounts
    WHERE company_id = v_company_id AND account_number = '2100'
  ) THEN
    INSERT INTO public.chart_of_accounts (
      company_id, account_number, account_name, account_type, account_category,
      normal_balance, current_balance, is_system_account, created_by
    ) VALUES (
      v_company_id, '2100', 'Credit Card Payable', 'liability', 'current_liabilities',
      'credit', 0, true, v_demo_user_id
    );
  END IF;

  SELECT id INTO v_ap_account_id
  FROM public.chart_of_accounts
  WHERE company_id = v_company_id AND account_number = '2000'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id INTO v_revenue_account_id
  FROM public.chart_of_accounts
  WHERE company_id = v_company_id AND account_number = '4000'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id INTO v_expense_account_id
  FROM public.chart_of_accounts
  WHERE company_id = v_company_id AND account_number = '5000'
  ORDER BY created_at DESC
  LIMIT 1;

  SELECT id INTO v_cc_liability_account_id
  FROM public.chart_of_accounts
  WHERE company_id = v_company_id AND account_number = '2100'
  ORDER BY created_at DESC
  LIMIT 1;

  -- Add additional cost codes for richer job/budget/transaction views.
  FOR i IN 1..24 LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.cost_codes
      WHERE company_id = v_company_id AND code = format('DEMO-%03s', i)
    ) THEN
      INSERT INTO public.cost_codes (
        company_id, code, description, type, is_active, require_attachment
      ) VALUES (
        v_company_id,
        format('DEMO-%03s', i),
        format('Demo Cost Code %s', i),
        NULL,
        true,
        false
      );
    END IF;
  END LOOP;

  -- 100 mock vendors with logos/icons for preview-heavy UI.
  FOR i IN 1..100 LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.vendors
      WHERE company_id = v_company_id
        AND name = format('Apex Mock Vendor %03s', i)
    ) THEN
      INSERT INTO public.vendors (
        company_id,
        name,
        vendor_type,
        contact_person,
        email,
        phone,
        address,
        city,
        state,
        zip_code,
        payment_terms,
        logo_url,
        is_active,
        require_invoice_number,
        notes
      ) VALUES (
        v_company_id,
        format('Apex Mock Vendor %03s', i),
        CASE WHEN i % 7 = 0 THEN 'Design Professional' WHEN i % 2 = 0 THEN 'Contractor' ELSE 'Supplier' END,
        format('Contact %s', i),
        format('vendor%03s@apex-demo.com', i),
        format('602555%04s', i),
        format('%s E Demo Ave', 100 + i),
        CASE WHEN i % 3 = 0 THEN 'Phoenix' WHEN i % 3 = 1 THEN 'Tempe' ELSE 'Scottsdale' END,
        'AZ',
        format('85%03s', (i % 900) + 100),
        CASE WHEN i % 3 = 0 THEN 'Net 15' WHEN i % 3 = 1 THEN 'Net 30' ELSE 'Net 45' END,
        format('https://picsum.photos/seed/apex-vendor-%s/240/240', i),
        true,
        true,
        'Demo seeded vendor with logo for UI previews.'
      );
    END IF;
  END LOOP;

  -- Add 3 additional jobs.
  FOR i IN 1..3 LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.jobs
      WHERE company_id = v_company_id
        AND name = format('Apex Demo Job %02s', i)
    ) THEN
      INSERT INTO public.jobs (
        company_id,
        name,
        project_number,
        client,
        address,
        status,
        budget,
        budget_total,
        start_date,
        end_date,
        description,
        is_active,
        created_by
      ) VALUES (
        v_company_id,
        format('Apex Demo Job %02s', i),
        format('APX-DEMO-%02s', i),
        CASE WHEN i = 1 THEN 'Skyline Dev Group' WHEN i = 2 THEN 'West Valley Schools' ELSE 'Sonoran Medical Partners' END,
        format('%s N Construction Way, Phoenix, AZ', 1500 + i * 250),
        'active',
        3500000 + (i * 1250000),
        3500000 + (i * 1250000),
        v_base_date + ((i - 1) * 18),
        v_base_date + (365 + i * 45),
        format('High-volume demo project %s for transaction, media, and job management testing.', i),
        true,
        v_demo_user_id
      );
    END IF;
  END LOOP;

  CREATE TEMP TABLE seed_jobs ON COMMIT DROP AS
  SELECT
    j.id,
    j.name,
    row_number() OVER (ORDER BY j.name) AS seq
  FROM public.jobs j
  WHERE j.company_id = v_company_id
    AND j.name LIKE 'Apex Demo Job %';

  CREATE TEMP TABLE seed_vendors ON COMMIT DROP AS
  SELECT
    v.id,
    v.name,
    row_number() OVER (ORDER BY v.name) AS seq
  FROM public.vendors v
  WHERE v.company_id = v_company_id
    AND v.name LIKE 'Apex Mock Vendor %';

  CREATE TEMP TABLE seed_cost_codes ON COMMIT DROP AS
  SELECT
    c.id,
    c.code,
    row_number() OVER (ORDER BY c.code) AS seq
  FROM public.cost_codes c
  WHERE c.company_id = v_company_id
  ORDER BY c.code
  LIMIT 24;

  SELECT count(*) INTO v_job_count FROM seed_jobs;
  SELECT count(*) INTO v_vendor_count FROM seed_vendors;
  SELECT count(*) INTO v_cost_code_count FROM seed_cost_codes;

  IF v_job_count = 0 OR v_vendor_count = 0 OR v_cost_code_count = 0 THEN
    RAISE NOTICE 'Seed prerequisites missing for Apex demo company; no data inserted.';
    RETURN;
  END IF;

  -- Budget lines per seeded job.
  FOR j_rec IN SELECT * FROM seed_jobs LOOP
    FOR i IN 1..12 LOOP
      SELECT id INTO v_cost_code_id
      FROM seed_cost_codes
      WHERE seq = ((i + j_rec.seq - 2) % v_cost_code_count) + 1;

      IF NOT EXISTS (
        SELECT 1 FROM public.job_budgets
        WHERE job_id = j_rec.id AND cost_code_id = v_cost_code_id
      ) THEN
        INSERT INTO public.job_budgets (
          job_id,
          cost_code_id,
          budgeted_amount,
          actual_amount,
          committed_amount,
          created_by
        ) VALUES (
          j_rec.id,
          v_cost_code_id,
          150000 + (i * 12000),
          65000 + (i * 7200),
          45000 + (i * 4300),
          v_demo_user_id
        );
      END IF;
    END LOOP;
  END LOOP;

  -- Committed contracts: 4 subcontracts per job.
  FOR j_rec IN SELECT * FROM seed_jobs LOOP
    FOR i IN 1..4 LOOP
      SELECT id INTO v_vendor_id
      FROM seed_vendors
      WHERE seq = ((j_rec.seq * 10 + i - 2) % v_vendor_count) + 1;

      INSERT INTO public.subcontracts (
        job_id,
        vendor_id,
        name,
        contract_amount,
        scope_of_work,
        description,
        status,
        start_date,
        end_date,
        created_by,
        contract_file_url
      ) VALUES (
        j_rec.id,
        v_vendor_id,
        format('%s - Package %s', j_rec.name, i),
        180000 + (i * 65000),
        format('Committed package %s for %s', i, j_rec.name),
        'Seeded committed contract for demo reporting.',
        'active',
        v_base_date + (i * 6),
        v_base_date + (210 + i * 20),
        v_demo_user_id,
        format('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf?subcontract=%s_%s', j_rec.seq, i)
      );
    END LOOP;
  END LOOP;

  -- RFPs, invites, bids, and bid attachments.
  FOR j_rec IN SELECT * FROM seed_jobs LOOP
    FOR i IN 1..8 LOOP
      v_rfp_id := gen_random_uuid();

      INSERT INTO public.rfps (
        id,
        company_id,
        job_id,
        rfp_number,
        title,
        description,
        scope_of_work,
        issue_date,
        due_date,
        status,
        created_by
      ) VALUES (
        v_rfp_id,
        v_company_id,
        j_rec.id,
        format('RFP-%s-%s', lpad(j_rec.seq::text, 2, '0'), lpad(i::text, 3, '0')),
        format('%s Bid Package %s', j_rec.name, i),
        'Seeded RFP with invites and bids for demo workflows.',
        'Provide labor, materials, and schedule commitment for scoped package.',
        v_base_date + (i * 5),
        v_base_date + (i * 5 + 14),
        'open',
        v_demo_user_id
      );

      FOR v IN 1..10 LOOP
        SELECT id INTO v_vendor_id
        FROM seed_vendors
        WHERE seq = ((j_rec.seq * 25 + i * 7 + v - 2) % v_vendor_count) + 1;

        INSERT INTO public.rfp_invited_vendors (
          company_id,
          rfp_id,
          vendor_id,
          response_status
        ) VALUES (
          v_company_id,
          v_rfp_id,
          v_vendor_id,
          CASE WHEN v % 4 = 0 THEN 'declined' WHEN v % 3 = 0 THEN 'submitted' ELSE 'invited' END
        );
      END LOOP;

      FOR b IN 1..3 LOOP
        SELECT id INTO v_vendor_id
        FROM seed_vendors
        WHERE seq = ((j_rec.seq * 30 + i * 5 + b - 2) % v_vendor_count) + 1;

        v_bid_id := gen_random_uuid();

        INSERT INTO public.bids (
          id,
          company_id,
          rfp_id,
          vendor_id,
          bid_amount,
          proposed_timeline,
          notes,
          status
        ) VALUES (
          v_bid_id,
          v_company_id,
          v_rfp_id,
          v_vendor_id,
          95000 + (i * 8000) + (b * 4500),
          format('%s weeks', 6 + b),
          'Seeded bid for comparison demo.',
          'submitted'
        );

        INSERT INTO public.bid_attachments (
          bid_id,
          company_id,
          file_name,
          file_type,
          file_url,
          uploaded_by
        ) VALUES (
          v_bid_id,
          v_company_id,
          format('Bid_%s_%s.pdf', i, b),
          'application/pdf',
          format('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf?bid=%s_%s', i, b),
          v_demo_user_id
        );
      END LOOP;
    END LOOP;
  END LOOP;

  -- Credit cards for transaction seeding.
  FOR i IN 1..4 LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.credit_cards
      WHERE company_id = v_company_id
        AND card_name = format('Apex Demo Card %s', i)
    ) THEN
      INSERT INTO public.credit_cards (
        company_id,
        card_name,
        issuer,
        cardholder_name,
        card_number_last_four,
        card_type,
        credit_limit,
        current_balance,
        liability_account_id,
        created_by,
        is_active
      ) VALUES (
        v_company_id,
        format('Apex Demo Card %s', i),
        CASE WHEN i % 2 = 0 THEN 'Amex' ELSE 'Visa' END,
        'Apex Construction',
        lpad((1200 + i)::text, 4, '0'),
        CASE WHEN i % 2 = 0 THEN 'Business' ELSE 'Corporate' END,
        90000,
        0,
        v_cc_liability_account_id,
        v_demo_user_id,
        true
      );
    END IF;
  END LOOP;

  CREATE TEMP TABLE seed_cards ON COMMIT DROP AS
  SELECT id, row_number() OVER (ORDER BY card_name) AS seq
  FROM public.credit_cards
  WHERE company_id = v_company_id
    AND card_name LIKE 'Apex Demo Card %';

  SELECT count(*) INTO v_card_count FROM seed_cards;

  -- Bank accounts (with statement/reconciliation data).
  FOR i IN 1..3 LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.bank_accounts
      WHERE company_id = v_company_id
        AND account_name = format('Apex Demo Bank %s', i)
    ) THEN
      INSERT INTO public.bank_accounts (
        company_id,
        account_name,
        bank_name,
        account_type,
        account_number,
        routing_number,
        initial_balance,
        current_balance,
        created_by,
        is_active
      ) VALUES (
        v_company_id,
        format('Apex Demo Bank %s', i),
        CASE WHEN i = 1 THEN 'Chase' WHEN i = 2 THEN 'Wells Fargo' ELSE 'Bank of America' END,
        'checking',
        format('00055%s88', i),
        format('12210%s901', i),
        250000,
        250000,
        v_demo_user_id,
        true
      );
    END IF;
  END LOOP;

  CREATE TEMP TABLE seed_bank_accounts ON COMMIT DROP AS
  SELECT
    b.id,
    b.chart_account_id,
    row_number() OVER (ORDER BY b.account_name) AS seq
  FROM public.bank_accounts b
  WHERE b.company_id = v_company_id
    AND b.account_name LIKE 'Apex Demo Bank %';

  SELECT count(*) INTO v_bank_count FROM seed_bank_accounts;

  -- High-volume invoices (bills), 60 per seeded job (non-committed).
  FOR j_rec IN SELECT * FROM seed_jobs LOOP
    FOR i IN 1..60 LOOP
      SELECT id INTO v_vendor_id
      FROM seed_vendors
      WHERE seq = ((j_rec.seq * 40 + i - 2) % v_vendor_count) + 1;

      SELECT id INTO v_cost_code_id
      FROM seed_cost_codes
      WHERE seq = ((j_rec.seq * 11 + i - 2) % v_cost_code_count) + 1;

      v_invoice_id := gen_random_uuid();
      v_amount := 1800 + ((i * 137 + j_rec.seq * 59) % 42000);

      INSERT INTO public.invoices (
        id,
        vendor_id,
        job_id,
        cost_code_id,
        invoice_number,
        amount,
        issue_date,
        due_date,
        status,
        description,
        file_url,
        created_by,
        is_subcontract_invoice,
        pending_coding,
        bill_category
      ) VALUES (
        v_invoice_id,
        v_vendor_id,
        j_rec.id,
        v_cost_code_id,
        format('INV-APX-%s-%s', lpad(j_rec.seq::text, 2, '0'), lpad(i::text, 4, '0')),
        v_amount,
        v_base_date + (i % 90),
        v_base_date + (i % 90) + 30,
        CASE WHEN i % 5 = 0 THEN 'paid' WHEN i % 3 = 0 THEN 'approved' ELSE 'pending' END,
        format('Seeded AP bill %s for %s', i, j_rec.name),
        format('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf?invoice=%s_%s', j_rec.seq, i),
        v_demo_user_id,
        false,
        false,
        'subcontract'
      );
    END LOOP;
  END LOOP;

  -- Credit card transactions + job/cost distributions, 25 per seeded job.
  IF v_card_count > 0 THEN
    FOR j_rec IN SELECT * FROM seed_jobs LOOP
      FOR i IN 1..25 LOOP
        SELECT id INTO v_vendor_id
        FROM seed_vendors
        WHERE seq = ((j_rec.seq * 17 + i - 2) % v_vendor_count) + 1;

        SELECT id INTO v_cost_code_id
        FROM seed_cost_codes
        WHERE seq = ((j_rec.seq * 9 + i - 2) % v_cost_code_count) + 1;

        SELECT id INTO v_card_id
        FROM seed_cards
        WHERE seq = ((j_rec.seq + i - 2) % v_card_count) + 1;

        v_cc_tx_id := gen_random_uuid();
        v_amount := 75 + ((i * 41 + j_rec.seq * 13) % 3200);

        INSERT INTO public.credit_card_transactions (
          id,
          company_id,
          credit_card_id,
          transaction_date,
          post_date,
          description,
          reference_number,
          amount,
          vendor_id,
          job_id,
          cost_code_id,
          coding_status,
          created_by,
          is_reconciled,
          attachment_url
        ) VALUES (
          v_cc_tx_id,
          v_company_id,
          v_card_id,
          v_base_date + (i % 90),
          v_base_date + (i % 90) + 2,
          format('Seeded card charge %s for %s', i, j_rec.name),
          format('CC-%s-%s', j_rec.seq, i),
          v_amount,
          v_vendor_id,
          j_rec.id,
          v_cost_code_id,
          'coded',
          v_demo_user_id,
          (i % 4 = 0),
          format('https://picsum.photos/seed/cc-receipt-%s-%s/900/1200', j_rec.seq, i)
        );

        INSERT INTO public.credit_card_transaction_distributions (
          company_id,
          transaction_id,
          job_id,
          cost_code_id,
          amount,
          percentage,
          created_by
        ) VALUES (
          v_company_id,
          v_cc_tx_id,
          j_rec.id,
          v_cost_code_id,
          v_amount,
          100,
          v_demo_user_id
        );
      END LOOP;
    END LOOP;
  END IF;

  -- Timecards for reporting density, 45 per seeded job.
  FOR j_rec IN SELECT * FROM seed_jobs LOOP
    FOR i IN 1..45 LOOP
      SELECT id INTO v_cost_code_id
      FROM seed_cost_codes
      WHERE seq = ((j_rec.seq * 5 + i - 2) % v_cost_code_count) + 1;

      INSERT INTO public.time_cards (
        company_id,
        user_id,
        job_id,
        cost_code_id,
        punch_in_time,
        punch_out_time,
        total_hours,
        break_minutes,
        overtime_hours,
        status,
        notes,
        created_via_punch_clock
      ) VALUES (
        v_company_id,
        v_demo_user_id,
        j_rec.id,
        v_cost_code_id,
        (v_base_date + (i % 70))::timestamp + INTERVAL '7 hours',
        (v_base_date + (i % 70))::timestamp + INTERVAL '16 hours',
        8,
        30,
        CASE WHEN i % 6 = 0 THEN 1 ELSE 0 END,
        'approved',
        format('Seeded timecard %s for %s', i, j_rec.name),
        true
      );
    END LOOP;
  END LOOP;

  -- Job photos/media, 40 per seeded job.
  FOR j_rec IN SELECT * FROM seed_jobs LOOP
    FOR i IN 1..40 LOOP
      INSERT INTO public.job_photos (
        job_id,
        uploaded_by,
        photo_url,
        note,
        location_address,
        location_lat,
        location_lng
      ) VALUES (
        j_rec.id,
        v_demo_user_id,
        format('https://picsum.photos/seed/apex-job-photo-%s-%s/1600/1000', j_rec.seq, i),
        format('Seeded progress photo %s for %s', i, j_rec.name),
        format('%s N Demo Site Rd, Phoenix, AZ', 700 + i),
        33.44 + (j_rec.seq * 0.01) + (i * 0.0001),
        -112.07 - (j_rec.seq * 0.01) - (i * 0.0001)
      );
    END LOOP;
  END LOOP;

  -- Payments for AP activity, 120 total.
  IF v_bank_count > 0 THEN
    FOR i IN 1..120 LOOP
      SELECT id INTO v_vendor_id
      FROM seed_vendors
      WHERE seq = ((i * 3 - 1) % v_vendor_count) + 1;

      SELECT id INTO v_bank_id
      FROM seed_bank_accounts
      WHERE seq = ((i - 1) % v_bank_count) + 1;

      v_payment_id := gen_random_uuid();
      v_amount := 1200 + ((i * 83) % 26000);

      INSERT INTO public.payments (
        id,
        company_id,
        vendor_id,
        bank_account_id,
        payment_number,
        payment_date,
        payment_method,
        amount,
        status,
        created_by,
        memo,
        check_number
      ) VALUES (
        v_payment_id,
        v_company_id,
        v_vendor_id,
        v_bank_id,
        format('PAY-APX-%s', lpad(i::text, 5, '0')),
        v_base_date + (i % 95),
        CASE WHEN i % 3 = 0 THEN 'check' WHEN i % 3 = 1 THEN 'ach' ELSE 'wire' END,
        v_amount,
        'cleared',
        v_demo_user_id,
        'Seeded AP payment for demo reconciliation and reporting.',
        format('10%s', lpad(i::text, 4, '0'))
      );
    END LOOP;
  END IF;

  -- Connect payments to invoices so bill payment history is populated.
  CREATE TEMP TABLE seed_invoices_for_payments ON COMMIT DROP AS
  SELECT id, amount, row_number() OVER (ORDER BY issue_date, id) AS seq
  FROM public.invoices
  WHERE vendor_id IN (SELECT id FROM seed_vendors)
    AND created_by = v_demo_user_id
  ORDER BY issue_date, id
  LIMIT 120;

  CREATE TEMP TABLE seed_payments_for_links ON COMMIT DROP AS
  SELECT id, amount, row_number() OVER (ORDER BY payment_date, id) AS seq
  FROM public.payments
  WHERE company_id = v_company_id
    AND payment_number LIKE 'PAY-APX-%'
  ORDER BY payment_date, id
  LIMIT 120;

  FOR i IN 1..120 LOOP
    INSERT INTO public.payment_invoice_lines (
      payment_id,
      invoice_id,
      amount_paid
    )
    SELECT
      p.id,
      inv.id,
      LEAST(p.amount, inv.amount)
    FROM seed_payments_for_links p
    JOIN seed_invoices_for_payments inv ON inv.seq = p.seq
    WHERE p.seq = i
      AND NOT EXISTS (
        SELECT 1 FROM public.payment_invoice_lines pil
        WHERE pil.payment_id = p.id AND pil.invoice_id = inv.id
      );
  END LOOP;

  -- Journal entries for deposits/withdrawals per bank account for reconciliation screens.
  FOR b_rec IN SELECT * FROM seed_bank_accounts LOOP
    IF b_rec.chart_account_id IS NULL THEN
      CONTINUE;
    END IF;

    FOR i IN 1..18 LOOP
      v_je_id := gen_random_uuid();
      v_amount := 3500 + ((i * 211) % 18000);

      INSERT INTO public.journal_entries (
        id,
        company_id,
        created_by,
        entry_date,
        description,
        reference,
        status,
        total_debit,
        total_credit,
        posted_at,
        posted_by
      ) VALUES (
        v_je_id,
        v_company_id,
        v_demo_user_id,
        v_base_date + (i % 90),
        'Seeded bank deposit entry',
        format('DEP-%s-%s', b_rec.seq, i),
        'posted',
        v_amount,
        v_amount,
        NOW(),
        v_demo_user_id
      );

      INSERT INTO public.journal_entry_lines (
        journal_entry_id,
        account_id,
        debit_amount,
        credit_amount,
        description,
        line_order
      ) VALUES
      (v_je_id, b_rec.chart_account_id, v_amount, 0, 'Deposit to bank account', 1),
      (v_je_id, v_revenue_account_id, 0, v_amount, 'Revenue offset', 2);
    END LOOP;

    FOR i IN 1..8 LOOP
      v_je_id := gen_random_uuid();
      v_amount := 900 + ((i * 133) % 6500);

      INSERT INTO public.journal_entries (
        id,
        company_id,
        created_by,
        entry_date,
        description,
        reference,
        status,
        total_debit,
        total_credit,
        posted_at,
        posted_by
      ) VALUES (
        v_je_id,
        v_company_id,
        v_demo_user_id,
        v_base_date + (i % 90),
        'Seeded bank withdrawal entry',
        format('WD-%s-%s', b_rec.seq, i),
        'posted',
        v_amount,
        v_amount,
        NOW(),
        v_demo_user_id
      );

      INSERT INTO public.journal_entry_lines (
        journal_entry_id,
        account_id,
        debit_amount,
        credit_amount,
        description,
        line_order
      ) VALUES
      (v_je_id, v_expense_account_id, v_amount, 0, 'Expense offset', 1),
      (v_je_id, b_rec.chart_account_id, 0, v_amount, 'Withdrawal from bank account', 2);
    END LOOP;
  END LOOP;

  -- Bank statements and completed reconciliations with cleared items.
  FOR b_rec IN SELECT * FROM seed_bank_accounts LOOP
    v_statement_id := gen_random_uuid();

    INSERT INTO public.bank_statements (
      id,
      company_id,
      bank_account_id,
      file_name,
      file_url,
      statement_date,
      statement_month,
      statement_year,
      uploaded_by,
      display_name
    ) VALUES (
      v_statement_id,
      v_company_id,
      b_rec.id,
      format('Apex_Statement_%s.pdf', b_rec.seq),
      format('https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf?statement=%s', b_rec.seq),
      CURRENT_DATE - INTERVAL '1 day',
      EXTRACT(MONTH FROM CURRENT_DATE - INTERVAL '1 day')::int,
      EXTRACT(YEAR FROM CURRENT_DATE - INTERVAL '1 day')::int,
      v_demo_user_id,
      format('Apex Demo Statement %s', b_rec.seq)
    );

    v_reconciliation_id := gen_random_uuid();

    INSERT INTO public.bank_reconciliations (
      id,
      company_id,
      bank_account_id,
      bank_statement_id,
      beginning_balance,
      ending_balance,
      beginning_date,
      ending_date,
      status,
      reconciled_at,
      reconciled_by,
      created_by,
      cleared_balance,
      adjusted_balance,
      notes
    ) VALUES (
      v_reconciliation_id,
      v_company_id,
      b_rec.id,
      v_statement_id,
      240000,
      252500 + (b_rec.seq * 1800),
      CURRENT_DATE - INTERVAL '31 days',
      CURRENT_DATE - INTERVAL '1 day',
      'completed',
      NOW(),
      v_demo_user_id,
      v_demo_user_id,
      252500 + (b_rec.seq * 1800),
      252500 + (b_rec.seq * 1800),
      'Seeded completed reconciliation for demo workflows.'
    );

    FOR p_rec IN (
      SELECT id, amount
      FROM public.payments
      WHERE bank_account_id = b_rec.id
      ORDER BY payment_date DESC, id DESC
      LIMIT 20
    ) LOOP
      INSERT INTO public.bank_reconciliation_items (
        reconciliation_id,
        transaction_id,
        transaction_type,
        amount,
        is_cleared,
        cleared_at
      ) VALUES (
        v_reconciliation_id,
        p_rec.id,
        'payment',
        p_rec.amount,
        true,
        NOW()
      );
    END LOOP;

    IF b_rec.chart_account_id IS NOT NULL THEN
      FOR p_rec IN (
        SELECT jel.id, jel.debit_amount
        FROM public.journal_entry_lines jel
        JOIN public.journal_entries je ON je.id = jel.journal_entry_id
        WHERE jel.account_id = b_rec.chart_account_id
          AND COALESCE(jel.debit_amount, 0) > 0
          AND je.status = 'posted'
        ORDER BY je.entry_date DESC, jel.id DESC
        LIMIT 10
      ) LOOP
        INSERT INTO public.bank_reconciliation_items (
          reconciliation_id,
          transaction_id,
          transaction_type,
          amount,
          is_cleared,
          cleared_at
        ) VALUES (
          v_reconciliation_id,
          p_rec.id,
          'deposit',
          p_rec.debit_amount,
          true,
          NOW()
        );
      END LOOP;
    END IF;
  END LOOP;

  -- Bring demo bank account balances in line with the latest seeded reconciliation.
  UPDATE public.bank_accounts ba
  SET current_balance = r.ending_balance
  FROM (
    SELECT DISTINCT ON (bank_account_id)
      bank_account_id,
      ending_balance
    FROM public.bank_reconciliations
    WHERE company_id = v_company_id
      AND status = 'completed'
    ORDER BY bank_account_id, ending_date DESC, created_at DESC
  ) r
  WHERE ba.id = r.bank_account_id;

  RAISE NOTICE 'Apex heavy demo seed complete: vendors=%, jobs=%, invoices/job=60, cc/job=25, timecards/job=45, photos/job=40.', v_vendor_count, v_job_count;
END;
$$;
