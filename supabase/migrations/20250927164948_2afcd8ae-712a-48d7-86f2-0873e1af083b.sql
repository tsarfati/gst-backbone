-- Fix chart_of_accounts data and add company separation

-- First, check if we have companies to work with
DO $$
DECLARE
    first_company_id uuid;
BEGIN
    -- Get the first company
    SELECT id INTO first_company_id FROM public.companies LIMIT 1;
    
    IF first_company_id IS NOT NULL THEN
        -- Add company_id column to chart_of_accounts
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chart_of_accounts' AND column_name = 'company_id') THEN
            ALTER TABLE public.chart_of_accounts ADD COLUMN company_id uuid REFERENCES public.companies(id);
        END IF;
        
        -- Update all chart_of_accounts records to belong to the first company
        UPDATE public.chart_of_accounts SET company_id = first_company_id WHERE company_id IS NULL;
        
        -- Make company_id required
        ALTER TABLE public.chart_of_accounts ALTER COLUMN company_id SET NOT NULL;
    END IF;
END $$;

-- Add company separation to other critical tables
-- cost_codes
ALTER TABLE public.cost_codes ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
UPDATE public.cost_codes SET company_id = (
  SELECT CASE 
    WHEN job_id IS NOT NULL THEN (SELECT company_id FROM jobs WHERE id = cost_codes.job_id)
    ELSE (SELECT id FROM companies LIMIT 1)
  END
) WHERE company_id IS NULL;
ALTER TABLE public.cost_codes ALTER COLUMN company_id SET NOT NULL;

-- time_cards  
ALTER TABLE public.time_cards ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
UPDATE public.time_cards SET company_id = (
  SELECT CASE 
    WHEN job_id IS NOT NULL THEN (SELECT company_id FROM jobs WHERE id = time_cards.job_id)
    ELSE (SELECT company_id FROM user_company_access WHERE user_id = time_cards.user_id LIMIT 1)
  END
) WHERE company_id IS NULL;
ALTER TABLE public.time_cards ALTER COLUMN company_id SET NOT NULL;

-- punch_records
ALTER TABLE public.punch_records ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
UPDATE public.punch_records SET company_id = (
  SELECT CASE 
    WHEN job_id IS NOT NULL THEN (SELECT company_id FROM jobs WHERE id = punch_records.job_id)
    ELSE (SELECT company_id FROM user_company_access WHERE user_id = punch_records.user_id LIMIT 1)
  END
) WHERE company_id IS NULL;
ALTER TABLE public.punch_records ALTER COLUMN company_id SET NOT NULL;