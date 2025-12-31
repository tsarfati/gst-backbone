-- Create AIA Invoice Templates table
CREATE TABLE public.aia_invoice_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.aia_invoice_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for company access
CREATE POLICY "Users can view their company AIA templates" 
ON public.aia_invoice_templates 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_id FROM user_company_access WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can create AIA templates for their company" 
ON public.aia_invoice_templates 
FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT company_id FROM user_company_access WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can update their company AIA templates" 
ON public.aia_invoice_templates 
FOR UPDATE 
USING (
  company_id IN (
    SELECT company_id FROM user_company_access WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can delete their company AIA templates" 
ON public.aia_invoice_templates 
FOR DELETE 
USING (
  company_id IN (
    SELECT company_id FROM user_company_access WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Create index for faster lookups
CREATE INDEX idx_aia_invoice_templates_company_id ON public.aia_invoice_templates(company_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_aia_invoice_templates_updated_at
BEFORE UPDATE ON public.aia_invoice_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();