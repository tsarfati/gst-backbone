-- Add vendor type restriction columns to payables_settings
ALTER TABLE public.payables_settings 
ADD COLUMN allowed_subcontract_vendor_types TEXT[] DEFAULT ARRAY['Contractor', 'Design Professional'],
ADD COLUMN allowed_po_vendor_types TEXT[] DEFAULT ARRAY['Supplier'];