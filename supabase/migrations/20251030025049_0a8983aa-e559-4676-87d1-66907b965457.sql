-- Make job_id nullable in invoices table for draft and distributed bills
ALTER TABLE invoices 
ALTER COLUMN job_id DROP NOT NULL;