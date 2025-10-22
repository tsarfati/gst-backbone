-- Step 2: Now fix the bill with updated triggers
UPDATE invoices 
SET cost_code_id = 'cc6ac3b7-7d2f-4a3d-bf34-0bbb50ed161f', status = 'pending_approval', pending_coding = false
WHERE id = 'a93fb285-6c94-4721-8177-158f3a16b9ed';