-- Add columns to pdf_templates table to support template file uploads
ALTER TABLE pdf_templates 
ADD COLUMN IF NOT EXISTS template_file_url TEXT,
ADD COLUMN IF NOT EXISTS template_file_name TEXT,
ADD COLUMN IF NOT EXISTS template_file_type TEXT CHECK (template_file_type IN ('docx', 'xlsx', 'pdf')),
ADD COLUMN IF NOT EXISTS template_format TEXT DEFAULT 'html' CHECK (template_format IN ('html', 'file')),
ADD COLUMN IF NOT EXISTS available_variables JSONB;

-- Add comment explaining the new columns
COMMENT ON COLUMN pdf_templates.template_file_url IS 'URL to uploaded template file (Word/Excel/PDF)';
COMMENT ON COLUMN pdf_templates.template_file_name IS 'Original filename of uploaded template';
COMMENT ON COLUMN pdf_templates.template_file_type IS 'Type of template file: docx, xlsx, or pdf';
COMMENT ON COLUMN pdf_templates.template_format IS 'Format type: html (legacy) or file (uploaded template)';
COMMENT ON COLUMN pdf_templates.available_variables IS 'JSON array of available variables for this template type';

-- Create storage bucket for report templates if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-templates', 'report-templates', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for report-templates bucket
CREATE POLICY "Authenticated users can view report templates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'report-templates');

CREATE POLICY "Authenticated users can upload report templates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'report-templates');

CREATE POLICY "Authenticated users can update their company report templates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'report-templates');

CREATE POLICY "Authenticated users can delete their company report templates"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'report-templates');