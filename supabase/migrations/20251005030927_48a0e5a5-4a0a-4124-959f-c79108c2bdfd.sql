-- Create table for QR card customization settings
CREATE TABLE IF NOT EXISTS public.qr_card_customization (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  base_url TEXT NOT NULL,
  header_text TEXT NOT NULL DEFAULT 'Employee Punch Clock Card',
  instructions_line1 TEXT NOT NULL DEFAULT 'Scan this QR code to access the Punch Clock',
  instructions_line2 TEXT NOT NULL DEFAULT 'Then enter your PIN to clock in/out',
  font TEXT NOT NULL DEFAULT 'helvetica',
  logo_url TEXT,
  footer_text TEXT NOT NULL DEFAULT 'Company',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_company_customization UNIQUE (company_id)
);

-- Enable Row Level Security
ALTER TABLE public.qr_card_customization ENABLE ROW LEVEL SECURITY;

-- Create policies for company access
CREATE POLICY "Users can view their company's QR customization"
ON public.qr_card_customization
FOR SELECT
USING (
  company_id IN (
    SELECT company_id FROM public.user_company_access
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can insert their company's QR customization"
ON public.qr_card_customization
FOR INSERT
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.user_company_access
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can update their company's QR customization"
ON public.qr_card_customization
FOR UPDATE
USING (
  company_id IN (
    SELECT company_id FROM public.user_company_access
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_qr_card_customization_updated_at
BEFORE UPDATE ON public.qr_card_customization
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();