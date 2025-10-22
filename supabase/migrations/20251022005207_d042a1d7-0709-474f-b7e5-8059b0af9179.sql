-- Fix cash accounts with incorrect normal balance
-- Cash accounts are assets and should have debit normal balance

-- Update all cash accounts to have correct debit normal balance
UPDATE chart_of_accounts
SET normal_balance = 'debit'
WHERE account_type = 'cash' 
  AND account_category IN ('cash_accounts', 'bank_accounts')
  AND normal_balance != 'debit';

-- Create a function to recalculate account balance from journal entries
CREATE OR REPLACE FUNCTION recalculate_account_balance(p_account_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  account_normal_balance text;
  calculated_balance numeric;
BEGIN
  -- Get the account's normal balance type
  SELECT normal_balance INTO account_normal_balance
  FROM chart_of_accounts
  WHERE id = p_account_id;
  
  -- Calculate balance from all journal entry lines
  IF account_normal_balance = 'debit' THEN
    SELECT COALESCE(SUM(debit_amount) - SUM(credit_amount), 0)
    INTO calculated_balance
    FROM journal_entry_lines
    WHERE account_id = p_account_id;
  ELSE
    SELECT COALESCE(SUM(credit_amount) - SUM(debit_amount), 0)
    INTO calculated_balance
    FROM journal_entry_lines
    WHERE account_id = p_account_id;
  END IF;
  
  -- Update the account balance
  UPDATE chart_of_accounts
  SET current_balance = calculated_balance
  WHERE id = p_account_id;
END;
$function$;

-- Recalculate balances for all cash accounts
DO $$
DECLARE
  account_record RECORD;
BEGIN
  FOR account_record IN 
    SELECT id FROM chart_of_accounts 
    WHERE account_type = 'cash' 
      AND account_category IN ('cash_accounts', 'bank_accounts')
  LOOP
    PERFORM recalculate_account_balance(account_record.id);
  END LOOP;
END;
$$;