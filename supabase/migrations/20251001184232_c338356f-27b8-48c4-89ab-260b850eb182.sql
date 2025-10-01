-- Add show_vendor_compliance_warnings column to payables_settings table
ALTER TABLE public.payables_settings 
ADD COLUMN IF NOT EXISTS show_vendor_compliance_warnings BOOLEAN NOT NULL DEFAULT true;