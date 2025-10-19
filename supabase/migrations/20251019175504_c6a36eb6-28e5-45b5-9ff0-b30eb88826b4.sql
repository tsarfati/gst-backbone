-- Add body_html column to pdf_templates for subcontract templates
ALTER TABLE public.pdf_templates
ADD COLUMN IF NOT EXISTS body_html TEXT;

COMMENT ON COLUMN public.pdf_templates.body_html IS 'Main body content HTML for documents like subcontracts';