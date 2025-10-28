-- Fix foreign key constraint on invoice_audit_trail to allow invoice deletion
-- Drop the existing foreign key constraint
ALTER TABLE public.invoice_audit_trail 
DROP CONSTRAINT IF EXISTS invoice_audit_trail_invoice_id_fkey;

-- Recreate the constraint with ON DELETE CASCADE
ALTER TABLE public.invoice_audit_trail
ADD CONSTRAINT invoice_audit_trail_invoice_id_fkey 
FOREIGN KEY (invoice_id) 
REFERENCES public.invoices(id) 
ON DELETE CASCADE;