-- Verify and add missing indexes for company_id columns

-- Add index on company_id for cost_codes if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_cost_codes_company_id ON public.cost_codes(company_id);

-- Add index on company_id for chart_of_accounts if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_company_id ON public.chart_of_accounts(company_id);

-- Verify data integrity - check for any orphaned records
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