-- Fix the existing incomplete payment (journal entry exists but credit_card_transactions record is missing)
INSERT INTO credit_card_transactions (
  credit_card_id,
  company_id,
  transaction_date,
  description,
  merchant_name,
  amount,
  transaction_type,
  coding_status,
  created_by
) VALUES (
  'c307ba50-d60b-4b36-9b7f-3386afbb40f8',
  'dcdfec98-5141-4559-adb2-fe1d70bfce98',
  '2025-07-24'::date,
  'Payment to Chase-MSCK',
  'TD',
  -5000.00,
  'payment',
  'coded',
  'dcdfec98-5141-4559-adb2-fe1d70bfce98'
) ON CONFLICT DO NOTHING;

-- Fix the journal entry total_debit and total_credit fields that were incorrectly set to 0
UPDATE journal_entries 
SET total_debit = 5000.00, 
    total_credit = 5000.00 
WHERE id = 'a89857f7-4abd-46c2-b3d1-31218cf66b2d'
  AND total_debit = 0 
  AND total_credit = 0;