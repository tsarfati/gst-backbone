-- Add bypass_attachment_requirement column to credit_card_transactions
ALTER TABLE credit_card_transactions 
ADD COLUMN IF NOT EXISTS bypass_attachment_requirement BOOLEAN DEFAULT false;

-- Add require_cc_attachment column to payables_settings
ALTER TABLE payables_settings
ADD COLUMN IF NOT EXISTS require_cc_attachment BOOLEAN DEFAULT false;