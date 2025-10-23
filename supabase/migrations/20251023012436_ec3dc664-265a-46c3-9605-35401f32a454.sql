-- Remove the old check constraint if it exists
ALTER TABLE credit_card_transactions 
DROP CONSTRAINT IF EXISTS credit_card_transactions_transaction_type_check;

-- Add a new check constraint that allows the transaction types we need
ALTER TABLE credit_card_transactions
ADD CONSTRAINT credit_card_transactions_transaction_type_check 
CHECK (transaction_type IS NULL OR transaction_type IN ('purchase', 'payment', 'refund', 'fee', 'adjustment'));