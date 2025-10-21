-- Add is_reconciled column to journal_entry_lines table
ALTER TABLE public.journal_entry_lines
ADD COLUMN is_reconciled BOOLEAN DEFAULT false;

-- Add reconciled_at and reconciled_by columns for audit tracking
ALTER TABLE public.journal_entry_lines
ADD COLUMN reconciled_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN reconciled_by UUID REFERENCES auth.users(id);