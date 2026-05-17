-- Scope account number uniqueness to each company
ALTER TABLE public.chart_of_accounts
  DROP CONSTRAINT IF EXISTS chart_of_accounts_account_number_key;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chart_of_accounts'
      AND column_name = 'company_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chart_of_accounts_company_account_unique'
      AND conrelid = 'public.chart_of_accounts'::regclass
  ) THEN
    ALTER TABLE public.chart_of_accounts
      ADD CONSTRAINT chart_of_accounts_company_account_unique UNIQUE (company_id, account_number);
  END IF;
END
$$;

-- Helpful index for lookups (optional, safe if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chart_of_accounts'
      AND column_name = 'company_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'idx_coa_company_account_number' AND n.nspname = 'public'
  ) THEN
    CREATE INDEX idx_coa_company_account_number
      ON public.chart_of_accounts (company_id, account_number);
  END IF;
END $$;
