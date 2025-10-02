-- Drop the trigger that auto-creates chart of accounts entries for bank accounts
DROP TRIGGER IF EXISTS create_cash_account_for_bank_trigger ON public.bank_accounts;

-- Remove the chart_account_id requirement since it will be manually associated
ALTER TABLE public.bank_accounts 
  ALTER COLUMN chart_account_id DROP NOT NULL;

-- Update the get_next_cash_account_number function to use 11120-11900 range
CREATE OR REPLACE FUNCTION public.get_next_cash_account_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    max_num INTEGER;
    next_num TEXT;
BEGIN
    -- Find the highest existing bank account number in the 11120-11900 range
    SELECT COALESCE(MAX(CAST(account_number AS INTEGER)), 11119) INTO max_num
    FROM public.chart_of_accounts 
    WHERE account_number ~ '^111[2-9][0-9]$' 
       OR account_number ~ '^11[2-8][0-9]{2}$'
       OR account_number = '11900';
    
    -- Generate next number in sequence
    IF max_num >= 11900 THEN
        RAISE EXCEPTION 'No more account numbers available in range 11120-11900';
    END IF;
    
    next_num := (max_num + 1)::TEXT;
    
    RETURN next_num;
END;
$function$;

-- Add account category 'bank_accounts' to chart_of_accounts if not exists
DO $$
BEGIN
    -- This is just to ensure the category can be used
    -- No constraint exists, but this documents the intended use
END $$;