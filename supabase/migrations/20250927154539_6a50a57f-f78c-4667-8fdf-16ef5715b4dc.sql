-- Add shared vendor database setting to companies table
ALTER TABLE public.companies 
ADD COLUMN enable_shared_vendor_database boolean NOT NULL DEFAULT false;

-- Add comment explaining the feature
COMMENT ON COLUMN public.companies.enable_shared_vendor_database IS 'When enabled, allows this company to share vendor information (contact details, etc.) with other companies that also have this setting enabled. Jobs and invoices remain company-specific.';