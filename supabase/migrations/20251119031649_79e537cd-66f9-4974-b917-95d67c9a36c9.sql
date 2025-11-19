-- Add retainage support to invoices table
ALTER TABLE invoices 
ADD COLUMN retainage_amount numeric DEFAULT 0,
ADD COLUMN retainage_percentage numeric DEFAULT 0;