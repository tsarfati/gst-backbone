-- Scope account number uniqueness to each company
ALTER TABLE public.chart_of_accounts
  DROP CONSTRAINT IF EXISTS chart_of_accounts_account_number_key;

ALTER TABLE public.chart_of_accounts
  ADD CONSTRAINT chart_of_accounts_company_account_unique UNIQUE (company_id, account_number);

-- Helpful index for lookups (optional, safe if exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_coa_company_account_number' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_coa_company_account_number
      ON public.chart_of_accounts (company_id, account_number);
  END IF;
END $$;