DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'companies_company_type_check'
      AND conrelid = 'public.companies'::regclass
  ) THEN
    ALTER TABLE public.companies
      DROP CONSTRAINT companies_company_type_check;
  END IF;

  ALTER TABLE public.companies
    ADD CONSTRAINT companies_company_type_check
    CHECK (company_type IN ('construction', 'design_professional', 'vendor'));
END $$;
