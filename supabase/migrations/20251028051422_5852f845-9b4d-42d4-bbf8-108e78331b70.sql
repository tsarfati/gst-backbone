-- Add require_attachment field to chart_of_accounts
ALTER TABLE chart_of_accounts
ADD COLUMN require_attachment boolean NOT NULL DEFAULT true;

-- Add require_attachment field to cost_codes
ALTER TABLE cost_codes
ADD COLUMN require_attachment boolean NOT NULL DEFAULT true;