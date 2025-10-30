-- Create credit card CSV formats table
CREATE TABLE IF NOT EXISTS public.credit_card_csv_formats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  format_name TEXT NOT NULL,
  columns JSONB NOT NULL,
  delimiter TEXT NOT NULL DEFAULT ',',
  has_header BOOLEAN NOT NULL DEFAULT true,
  date_format TEXT NOT NULL DEFAULT 'MM/DD/YYYY',
  amount_format TEXT NOT NULL DEFAULT '$#,###.##',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Add csv_format_id to credit_cards table
ALTER TABLE public.credit_cards 
ADD COLUMN IF NOT EXISTS csv_format_id TEXT;

-- Enable RLS
ALTER TABLE public.credit_card_csv_formats ENABLE ROW LEVEL SECURITY;

-- Create policies for credit_card_csv_formats (using profiles table)
CREATE POLICY "Users can view formats for their company" 
ON public.credit_card_csv_formats 
FOR SELECT 
USING (
  company_id IN (
    SELECT current_company_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can create formats for their company" 
ON public.credit_card_csv_formats 
FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT current_company_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update formats for their company" 
ON public.credit_card_csv_formats 
FOR UPDATE 
USING (
  company_id IN (
    SELECT current_company_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete formats for their company" 
ON public.credit_card_csv_formats 
FOR DELETE 
USING (
  company_id IN (
    SELECT current_company_id 
    FROM public.profiles 
    WHERE id = auth.uid()
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_credit_card_csv_formats_updated_at
BEFORE UPDATE ON public.credit_card_csv_formats
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index
CREATE INDEX IF NOT EXISTS idx_credit_card_csv_formats_company 
ON public.credit_card_csv_formats(company_id);