-- Add bank_account_id column to payments table
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id);