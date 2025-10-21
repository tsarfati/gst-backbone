-- Add bank statement naming pattern to file upload settings
ALTER TABLE public.file_upload_settings 
ADD COLUMN IF NOT EXISTS bank_statement_naming_pattern TEXT DEFAULT '{bank_name}_{account_name}_{month}_{year}';