-- Add customer_number to vendors for storing per-vendor account/customer IDs
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS customer_number text;