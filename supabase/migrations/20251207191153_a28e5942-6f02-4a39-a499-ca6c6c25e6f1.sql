
-- Fix journal entry lines incorrectly posted to 41000 (revenue) instead of 51000 (expense)
-- These are credit card expense transactions that should be in the expense account

-- For company f64fff8d-16f4-4a07-81b3-e470d7e2d560:
-- Current incorrect account: 69ab1cfa-bda0-4b19-9f7b-aaa77618dad2 (41000 - revenue)
-- Correct expense account: bec95e10-df14-41a1-87f5-fbb370bd755a (51000 - expense)

UPDATE journal_entry_lines
SET account_id = 'bec95e10-df14-41a1-87f5-fbb370bd755a'
WHERE account_id = '69ab1cfa-bda0-4b19-9f7b-aaa77618dad2';

-- Recalculate the account balances for both affected accounts
-- First, recalculate the 41000 revenue account balance (should now be lower)
SELECT public.recalculate_account_balance('69ab1cfa-bda0-4b19-9f7b-aaa77618dad2'::uuid);

-- Then, recalculate the 51000 expense account balance (should now be higher)
SELECT public.recalculate_account_balance('bec95e10-df14-41a1-87f5-fbb370bd755a'::uuid);
