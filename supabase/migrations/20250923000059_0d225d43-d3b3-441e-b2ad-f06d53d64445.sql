-- Add IP address tracking to punch records
ALTER TABLE punch_records 
ADD COLUMN IF NOT EXISTS ip_address text,
ADD COLUMN IF NOT EXISTS user_agent text;