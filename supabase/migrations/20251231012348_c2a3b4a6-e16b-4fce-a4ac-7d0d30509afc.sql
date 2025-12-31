-- Add use_company_logo column to pdf_templates table
ALTER TABLE public.pdf_templates 
ADD COLUMN IF NOT EXISTS use_company_logo boolean DEFAULT false;