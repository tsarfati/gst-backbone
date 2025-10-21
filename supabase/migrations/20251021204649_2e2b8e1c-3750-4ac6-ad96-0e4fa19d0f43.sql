-- Add reversal tracking fields to journal_entries table
ALTER TABLE journal_entries
ADD COLUMN IF NOT EXISTS reversal_date date,
ADD COLUMN IF NOT EXISTS reversed_by_entry_id uuid REFERENCES journal_entries(id);