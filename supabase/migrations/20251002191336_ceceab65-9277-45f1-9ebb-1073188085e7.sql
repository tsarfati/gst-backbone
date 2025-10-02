-- Add fields to payments table for partial payment tracking and document storage
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS is_partial_payment boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS payment_document_url text;