-- Add bill approval requirement setting to company_settings
ALTER TABLE public.company_settings
ADD COLUMN IF NOT EXISTS require_bill_approval boolean NOT NULL DEFAULT false;