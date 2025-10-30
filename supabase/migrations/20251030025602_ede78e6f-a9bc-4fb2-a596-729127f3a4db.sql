-- Make issue_date nullable for draft bills
ALTER TABLE invoices 
ALTER COLUMN issue_date DROP NOT NULL;