-- Add banner_url column to jobs table
ALTER TABLE public.jobs ADD COLUMN banner_url TEXT;

-- Create company_settings table for payment terms and other settings
CREATE TABLE public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_terms_options TEXT[] NOT NULL DEFAULT ARRAY['asap', '15', '30'],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for company_settings
CREATE POLICY "Users can view their own company settings" 
ON public.company_settings 
FOR SELECT 
USING (auth.uid() = company_id);

CREATE POLICY "Users can create their own company settings" 
ON public.company_settings 
FOR INSERT 
WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Users can update their own company settings" 
ON public.company_settings 
FOR UPDATE 
USING (auth.uid() = company_id);

-- Create trigger for updated_at column
CREATE TRIGGER update_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();