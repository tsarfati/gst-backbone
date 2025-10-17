-- Add pending_coding status support and project manager assignment for invoices

-- Update invoices table to add pending_coding flag and assigned_to field
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS pending_coding boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS assigned_to_pm uuid REFERENCES auth.users(id);

-- Create index for faster queries on pending_coding bills
CREATE INDEX IF NOT EXISTS idx_invoices_pending_coding ON public.invoices(pending_coding, job_id) WHERE pending_coding = true;

-- Add comment for documentation
COMMENT ON COLUMN public.invoices.pending_coding IS 'Indicates if bill needs coding by project manager';
COMMENT ON COLUMN public.invoices.assigned_to_pm IS 'Project manager assigned to code this bill';