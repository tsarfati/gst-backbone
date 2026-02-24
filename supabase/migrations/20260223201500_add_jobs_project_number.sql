-- Add a user-managed project/job number for customer-facing documents (AIA invoices, etc.)
ALTER TABLE public.jobs
ADD COLUMN IF NOT EXISTS project_number TEXT;
