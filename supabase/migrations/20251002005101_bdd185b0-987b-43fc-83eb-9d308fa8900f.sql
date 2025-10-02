-- Add require_bill_documents column to payables_settings table
ALTER TABLE payables_settings 
ADD COLUMN IF NOT EXISTS require_bill_documents BOOLEAN DEFAULT false NOT NULL;