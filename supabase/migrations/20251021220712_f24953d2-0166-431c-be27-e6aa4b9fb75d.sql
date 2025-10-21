-- Update the existing bank statement to have the correct statement date
-- This fixes the issue where the statement uploaded during April reconciliation 
-- was not showing up in the bank statements section
UPDATE bank_statements 
SET statement_date = '2025-04-30',
    statement_month = 4,
    statement_year = 2025
WHERE id = '8a1eac58-ebc0-4066-b04b-1be93fa974fc';

-- Link the bank statement to the reconciliation
UPDATE bank_reconciliations
SET bank_statement_id = '8a1eac58-ebc0-4066-b04b-1be93fa974fc'
WHERE id = 'a1ab74ba-7e3e-4ff5-975a-7794944f9c64';

-- Fix the journal entry lines that should be reconciled but aren't
-- Mark all lines in journal entries that have at least one reconciled line as reconciled
UPDATE journal_entry_lines jel
SET is_reconciled = true,
    reconciled_at = COALESCE(reconciled_at, NOW()),
    reconciled_by = COALESCE(reconciled_by, (
      SELECT reconciled_by FROM journal_entry_lines 
      WHERE journal_entry_id = jel.journal_entry_id 
        AND is_reconciled = true 
      LIMIT 1
    ))
WHERE jel.journal_entry_id IN (
  SELECT DISTINCT journal_entry_id 
  FROM journal_entry_lines 
  WHERE is_reconciled = true
)
AND jel.is_reconciled = false;