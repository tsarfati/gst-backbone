
-- Add company_id to payments table for proper filtering
ALTER TABLE payments ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_company_id ON payments(company_id);

-- Backfill company_id from vendors table for existing payments
UPDATE payments p
SET company_id = v.company_id
FROM vendors v
WHERE p.vendor_id = v.id
  AND p.company_id IS NULL;

-- Insert the missing Butler HVAC payment
INSERT INTO payments (
  amount,
  payment_date,
  payment_method,
  payment_number,
  vendor_id,
  journal_entry_id,
  created_by,
  memo,
  status,
  company_id
)
SELECT
  7200.00,
  '2025-09-29'::date,
  'credit_card',
  'CC-AMEX-115-2025-09-29',
  'a63784f8-ecfa-4bd9-ba02-2ed367c5263f'::uuid,
  'e0d21b99-542e-41ba-855e-8e9ef1c03cd3'::uuid,
  cct.created_by,
  'Credit Card Payment via AMEX-115 - WILLIAM BUTLER      Philadelphia        PA',
  'cleared',
  'f64fff8d-16f4-4a07-81b3-e470d7e2d560'::uuid
FROM credit_card_transactions cct
WHERE cct.id = '078b95f0-0560-4132-b0ab-8d21c8f5fb49'::uuid
ON CONFLICT DO NOTHING;

-- Create the payment invoice link
INSERT INTO payment_invoice_lines (
  payment_id,
  invoice_id,
  amount_paid
)
SELECT
  p.id,
  'd03eb8f6-476e-4e2c-86d4-29e9fcaa8f75'::uuid,
  7200.00
FROM payments p
WHERE p.journal_entry_id = 'e0d21b99-542e-41ba-855e-8e9ef1c03cd3'::uuid
  AND NOT EXISTS (
    SELECT 1 FROM payment_invoice_lines pil 
    WHERE pil.payment_id = p.id 
    AND pil.invoice_id = 'd03eb8f6-476e-4e2c-86d4-29e9fcaa8f75'::uuid
  );
