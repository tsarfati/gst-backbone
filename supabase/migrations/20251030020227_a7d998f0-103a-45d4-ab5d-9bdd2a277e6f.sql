-- Add journal_entry_id to credit_card_transactions table to track posted transactions
ALTER TABLE credit_card_transactions
ADD COLUMN journal_entry_id uuid REFERENCES journal_entries(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_credit_card_transactions_journal_entry 
ON credit_card_transactions(journal_entry_id) 
WHERE journal_entry_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN credit_card_transactions.journal_entry_id IS 'Links to journal entry when transaction is posted to GL';