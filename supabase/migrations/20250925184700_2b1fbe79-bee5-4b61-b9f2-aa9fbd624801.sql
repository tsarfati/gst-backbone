-- Add bill category field to invoices table
ALTER TABLE public.invoices 
ADD COLUMN bill_category text DEFAULT 'one_time' CHECK (bill_category IN ('reimbursable', 'subcontract', 'purchase_order', 'one_time'));