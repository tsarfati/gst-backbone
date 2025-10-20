-- Delete duplicate payment records for the test bill
DELETE FROM payment_invoice_lines 
WHERE payment_id IN (
  '2a8fb4ac-089d-4a05-b739-8bdee9eb79ba',
  '2de5efd2-15f1-4a70-a398-8f5bf5b85645',
  '0e5c53b4-53e0-43bd-b935-802fd1adb991',
  '759924b4-6a58-4ecb-9861-67f381c5afe0'
);

DELETE FROM payments 
WHERE id IN (
  '2a8fb4ac-089d-4a05-b739-8bdee9eb79ba',
  '2de5efd2-15f1-4a70-a398-8f5bf5b85645',
  '0e5c53b4-53e0-43bd-b935-802fd1adb991',
  '759924b4-6a58-4ecb-9861-67f381c5afe0'
);