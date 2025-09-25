-- Add is_reimbursement column to invoices table
ALTER TABLE public.invoices ADD COLUMN is_reimbursement BOOLEAN NOT NULL DEFAULT false;

-- Update bill statuses to use pending_approval instead of pending for new bills
-- This is handled by the application logic, but we can set a default status
ALTER TABLE public.invoices ALTER COLUMN status SET DEFAULT 'pending_approval';

-- Add comment for clarity
COMMENT ON COLUMN public.invoices.is_reimbursement IS 'Indicates if this bill is for a reimbursement payment';