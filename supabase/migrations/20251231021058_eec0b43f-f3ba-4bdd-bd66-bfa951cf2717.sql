-- Add logo_url column to pdf_templates table
ALTER TABLE public.pdf_templates 
ADD COLUMN IF NOT EXISTS logo_url text;