-- Insert default timecard PDF templates for existing companies
INSERT INTO public.pdf_templates (
  company_id,
  template_type,
  template_name,
  font_family,
  primary_color,
  table_border_color,
  table_stripe_color,
  auto_size_columns,
  header_html,
  footer_html,
  created_by
)
SELECT 
  c.id as company_id,
  'timecard' as template_type,
  'Clean Template' as template_name,
  'helvetica' as font_family,
  '#f1f5f9' as primary_color,
  '#e2e8f0' as table_border_color,
  '#f8fafc' as table_stripe_color,
  true as auto_size_columns,
  'Company: {company_name} | Period: {period} | Generated: {generated_date}' as header_html,
  'Page {page} of {pages}' as footer_html,
  c.created_by
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.pdf_templates pt 
  WHERE pt.company_id = c.id AND pt.template_type = 'timecard'
);

-- Insert contrast template
INSERT INTO public.pdf_templates (
  company_id,
  template_type,
  template_name,
  font_family,
  primary_color,
  table_border_color,
  table_stripe_color,
  auto_size_columns,
  header_html,
  footer_html,
  created_by
)
SELECT 
  c.id as company_id,
  'timecard' as template_type,
  'Contrast Template' as template_name,
  'helvetica' as font_family,
  '#0f172a' as primary_color,
  '#334155' as table_border_color,
  '#111827' as table_stripe_color,
  false as auto_size_columns,
  'Company: {company_name} | Period: {period} | Generated: {generated_date}' as header_html,
  'Page {page} of {pages}' as footer_html,
  c.created_by
FROM public.companies c;

-- Insert striped template
INSERT INTO public.pdf_templates (
  company_id,
  template_type,
  template_name,
  font_family,
  primary_color,
  table_border_color,
  table_stripe_color,
  auto_size_columns,
  header_html,
  footer_html,
  created_by
)
SELECT 
  c.id as company_id,
  'timecard' as template_type,
  'Striped Template' as template_name,
  'times' as font_family,
  '#e2e8f0' as primary_color,
  '#94a3b8' as table_border_color,
  '#f1f5f9' as table_stripe_color,
  true as auto_size_columns,
  'Company: {company_name} | Period: {period} | Generated: {generated_date}' as header_html,
  'Page {page} of {pages}' as footer_html,
  c.created_by
FROM public.companies c;