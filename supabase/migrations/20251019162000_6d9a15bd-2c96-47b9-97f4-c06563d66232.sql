-- Update pdf_templates table to support new HTML-based template structure
ALTER TABLE pdf_templates
  DROP COLUMN IF EXISTS header_text,
  DROP COLUMN IF EXISTS footer_text,
  DROP COLUMN IF EXISTS show_logo,
  DROP COLUMN IF EXISTS show_company_info,
  DROP COLUMN IF EXISTS show_contact_info;

ALTER TABLE pdf_templates
  ADD COLUMN IF NOT EXISTS header_html TEXT,
  ADD COLUMN IF NOT EXISTS footer_html TEXT,
  ADD COLUMN IF NOT EXISTS auto_size_columns BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS header_images JSONB DEFAULT '[]'::jsonb;