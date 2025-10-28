-- Add website_address and login_information columns to vendor_payment_methods
ALTER TABLE public.vendor_payment_methods
ADD COLUMN IF NOT EXISTS website_address TEXT,
ADD COLUMN IF NOT EXISTS login_information TEXT;