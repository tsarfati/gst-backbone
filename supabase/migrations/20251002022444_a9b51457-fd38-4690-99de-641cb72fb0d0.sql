-- Check what values are allowed in account_type
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name = 'chart_of_accounts_account_type_check';

-- Drop the constraint to see what it was
ALTER TABLE public.chart_of_accounts DROP CONSTRAINT IF EXISTS chart_of_accounts_account_type_check;

-- Add the constraint back with 'cash' included
ALTER TABLE public.chart_of_accounts 
ADD CONSTRAINT chart_of_accounts_account_type_check 
CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense', 'cash'));