-- Add is_reversed column to journal_entries table
ALTER TABLE journal_entries 
ADD COLUMN IF NOT EXISTS is_reversed BOOLEAN DEFAULT false;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_journal_entries_is_reversed 
ON journal_entries(is_reversed) WHERE is_reversed = true;

-- Update existing reversed entries (entries with reversal_date set)
UPDATE journal_entries 
SET is_reversed = true 
WHERE reversal_date IS NOT NULL;