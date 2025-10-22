-- Add company_id column to time_card_change_requests for better filtering
ALTER TABLE time_card_change_requests
ADD COLUMN company_id uuid REFERENCES companies(id);

-- Backfill company_id from the related time_card
UPDATE time_card_change_requests tcr
SET company_id = tc.company_id
FROM time_cards tc
WHERE tcr.time_card_id = tc.id;

-- Make company_id NOT NULL now that it's populated
ALTER TABLE time_card_change_requests
ALTER COLUMN company_id SET NOT NULL;

-- Add index for faster filtering
CREATE INDEX idx_time_card_change_requests_company_id ON time_card_change_requests(company_id);

-- Add index for common query pattern (company + status)
CREATE INDEX idx_time_card_change_requests_company_status ON time_card_change_requests(company_id, status);