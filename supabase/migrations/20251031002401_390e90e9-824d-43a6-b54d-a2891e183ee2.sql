-- Ensure the use_accrual_accounting column exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'company_settings' 
    AND column_name = 'use_accrual_accounting'
  ) THEN
    ALTER TABLE public.company_settings 
    ADD COLUMN use_accrual_accounting boolean NOT NULL DEFAULT false;
  END IF;
END $$;