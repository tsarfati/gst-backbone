-- Fix: ensure cash account creation sets company_id and trigger exists
CREATE OR REPLACE FUNCTION public.create_cash_account_for_bank()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    new_account_number TEXT;
    chart_account_id UUID;
BEGIN
    -- Generate next available cash account number
    new_account_number := get_next_cash_account_number();
    
    -- Create the cash account in chart of accounts (include company_id!)
    INSERT INTO public.chart_of_accounts (
        account_number,
        account_name,
        account_type,
        account_category,
        normal_balance,
        current_balance,
        is_system_account,
        is_active,
        created_by,
        company_id
    ) VALUES (
        new_account_number,
        NEW.account_name || ' - ' || NEW.bank_name,
        'cash',
        'cash_accounts',
        'debit',
        NEW.initial_balance,
        false,
        true,
        NEW.created_by,
        NEW.company_id
    )
    RETURNING id INTO chart_account_id;
    
    -- Update the bank account with the chart account reference and starting balance
    NEW.chart_account_id := chart_account_id;
    NEW.current_balance := NEW.initial_balance;
    
    RETURN NEW;
END;
$function$;

-- Ensure trigger exists to call the function on bank_accounts insert
DROP TRIGGER IF EXISTS create_cash_account_for_bank_trigger ON public.bank_accounts;
CREATE TRIGGER create_cash_account_for_bank_trigger
BEFORE INSERT ON public.bank_accounts
FOR EACH ROW
EXECUTE FUNCTION public.create_cash_account_for_bank();