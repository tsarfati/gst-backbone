-- Add scope_of_work to subcontracts table
ALTER TABLE public.subcontracts 
ADD COLUMN IF NOT EXISTS scope_of_work TEXT;

-- Add multi-template support to pdf_templates
-- First, drop the old unique constraint
ALTER TABLE public.pdf_templates 
DROP CONSTRAINT IF EXISTS pdf_templates_company_id_template_type_key;

-- Add new columns for template variants and multi-page support
ALTER TABLE public.pdf_templates
ADD COLUMN IF NOT EXISTS template_name TEXT DEFAULT 'default',
ADD COLUMN IF NOT EXISTS pages JSONB DEFAULT '[]'::jsonb;

-- Create new unique constraint including template_name
ALTER TABLE public.pdf_templates
ADD CONSTRAINT pdf_templates_company_type_name_unique 
UNIQUE (company_id, template_type, template_name);

-- Create index for faster lookups with template name
CREATE INDEX IF NOT EXISTS idx_pdf_templates_company_type_name 
ON public.pdf_templates(company_id, template_type, template_name);

-- Add comment to explain template_name
COMMENT ON COLUMN public.pdf_templates.template_name IS 'Template variant name (e.g., "short", "long", "standard", "default")';

-- Add comment to explain pages structure
COMMENT ON COLUMN public.pdf_templates.pages IS 'Array of page configurations for multi-page templates: [{"header_html": "...", "footer_html": "...", "content_placeholders": [...]}]';