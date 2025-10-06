-- Add required fields settings for subcontracts and purchase orders to job_settings table
ALTER TABLE job_settings 
ADD COLUMN IF NOT EXISTS subcontract_required_fields jsonb DEFAULT '["name", "job_id", "vendor_id", "contract_amount"]'::jsonb,
ADD COLUMN IF NOT EXISTS po_required_fields jsonb DEFAULT '["po_number", "job_id", "vendor_id", "amount"]'::jsonb;