-- Add journal entry deletion control setting to companies table
ALTER TABLE companies 
ADD COLUMN allow_journal_entry_deletion boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN companies.allow_journal_entry_deletion IS 'Controls whether journal entries can be deleted (true) or only reversed (false). Default is false (only allow reversals).';