ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS company_type text NOT NULL DEFAULT 'construction';

UPDATE public.companies
SET company_type = 'construction'
WHERE company_type IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'companies_company_type_check'
  ) THEN
    ALTER TABLE public.companies
    ADD CONSTRAINT companies_company_type_check
    CHECK (company_type IN ('construction', 'design_professional'));
  END IF;
END;
$$;
