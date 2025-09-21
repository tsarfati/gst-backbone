-- Add vendor_type field to vendors table
ALTER TABLE public.vendors 
ADD COLUMN vendor_type TEXT DEFAULT 'Other';

-- Add check constraint for valid vendor types
ALTER TABLE public.vendors 
ADD CONSTRAINT vendors_vendor_type_check 
CHECK (vendor_type IN ('Contractor', 'Supplier', 'Consultant', 'Design Professional', 'Other'));