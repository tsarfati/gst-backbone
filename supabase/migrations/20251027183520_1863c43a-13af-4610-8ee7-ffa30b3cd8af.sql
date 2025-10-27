-- Add fields to track transaction matching and confirmation (without FK constraints)
ALTER TABLE credit_card_transactions
ADD COLUMN IF NOT EXISTS match_confirmed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS matched_bill_id UUID,
ADD COLUMN IF NOT EXISTS matched_receipt_id UUID,
ADD COLUMN IF NOT EXISTS matched_payment_id UUID;