-- Add foreign key from chart_of_accounts to companies (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'chart_of_accounts_company_id_fkey'
    ) THEN
        ALTER TABLE public.chart_of_accounts 
        ADD CONSTRAINT chart_of_accounts_company_id_fkey 
        FOREIGN KEY (company_id) 
        REFERENCES public.companies(id) 
        ON DELETE CASCADE;
    END IF;
END $$;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cost_codes_company_id ON public.cost_codes(company_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_company_id ON public.chart_of_accounts(company_id);

-- Verify data integrity
DO $$
DECLARE
    orphaned_cost_codes INTEGER;
    orphaned_accounts INTEGER;
BEGIN
    -- Check for orphaned cost codes
    SELECT COUNT(*) INTO orphaned_cost_codes
    FROM public.cost_codes cc
    WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = cc.company_id);
    
    IF orphaned_cost_codes > 0 THEN
        RAISE NOTICE 'Found % cost codes with invalid company references', orphaned_cost_codes;
    ELSE
        RAISE NOTICE 'All cost codes have valid company references';
    END IF;
    
    -- Check for orphaned chart of accounts
    SELECT COUNT(*) INTO orphaned_accounts
    FROM public.chart_of_accounts coa
    WHERE NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = coa.company_id);
    
    IF orphaned_accounts > 0 THEN
        RAISE NOTICE 'Found % chart of accounts with invalid company references', orphaned_accounts;
    ELSE
        RAISE NOTICE 'All chart of accounts have valid company references';
    END IF;
END $$;