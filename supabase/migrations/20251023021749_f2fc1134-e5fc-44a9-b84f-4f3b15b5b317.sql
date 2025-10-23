-- Add credit card charge flag to receipts
ALTER TABLE public.receipts 
ADD COLUMN is_credit_card_charge BOOLEAN NOT NULL DEFAULT false;

-- Add index for better performance when filtering by credit card charges
CREATE INDEX idx_receipts_is_credit_card_charge ON public.receipts(is_credit_card_charge);