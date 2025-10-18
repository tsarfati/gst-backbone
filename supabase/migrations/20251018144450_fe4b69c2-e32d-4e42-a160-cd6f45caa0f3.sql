-- Add require_invoice_number field to vendors table
ALTER TABLE public.vendors 
ADD COLUMN require_invoice_number boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.vendors.require_invoice_number IS 'Whether this vendor requires invoice numbers on bills';