-- Create PDF templates table
CREATE TABLE IF NOT EXISTS public.pdf_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  template_type TEXT NOT NULL,
  header_text TEXT,
  footer_text TEXT,
  show_logo BOOLEAN NOT NULL DEFAULT true,
  show_company_info BOOLEAN NOT NULL DEFAULT true,
  show_contact_info BOOLEAN NOT NULL DEFAULT true,
  font_family TEXT NOT NULL DEFAULT 'helvetica',
  primary_color TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  UNIQUE(company_id, template_type)
);

-- Enable RLS
ALTER TABLE public.pdf_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view templates for their companies
CREATE POLICY "Users can view templates for their companies"
  ON public.pdf_templates
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id 
      FROM get_user_companies(auth.uid())
    )
  );

-- Policy: Admins and controllers can manage templates
CREATE POLICY "Admins and controllers can manage templates"
  ON public.pdf_templates
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id 
      FROM get_user_companies(auth.uid())
      WHERE role IN ('admin', 'controller')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT company_id 
      FROM get_user_companies(auth.uid())
      WHERE role IN ('admin', 'controller')
    )
  );

-- Create index for faster lookups
CREATE INDEX idx_pdf_templates_company_type ON public.pdf_templates(company_id, template_type);