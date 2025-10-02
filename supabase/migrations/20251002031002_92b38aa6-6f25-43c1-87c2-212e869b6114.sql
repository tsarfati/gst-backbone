-- Add display_name field to bank_statements for custom naming
ALTER TABLE public.bank_statements
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Add display_name field to reconcile_reports for custom naming  
ALTER TABLE public.reconcile_reports
  ADD COLUMN IF NOT EXISTS display_name TEXT;