
-- Update first bill to have total amount and remove cost_code_id
UPDATE invoices 
SET amount = 2160.00, 
    cost_code_id = NULL, 
    invoice_number = '08.01.25'
WHERE id = 'fa4734e1-2368-4b64-8482-58dc95fe4e95';

-- Create distribution records for the merged bill
INSERT INTO invoice_cost_distributions (invoice_id, cost_code_id, amount, percentage)
VALUES 
  ('fa4734e1-2368-4b64-8482-58dc95fe4e95', 'e62ea3e1-977a-44c9-bb87-78678dcd7009', 1080.00, 50),
  ('fa4734e1-2368-4b64-8482-58dc95fe4e95', '0f47ca8a-9a3e-4940-af27-e611b0d4a40a', 1080.00, 50);

-- Move the document to the first invoice (if not already there)
UPDATE invoice_documents 
SET invoice_id = 'fa4734e1-2368-4b64-8482-58dc95fe4e95'
WHERE invoice_id = '4d59eb24-4d73-4c5f-8b03-f452d80e2c26';

-- Delete the second bill
DELETE FROM invoices WHERE id = '4d59eb24-4d73-4c5f-8b03-f452d80e2c26';
