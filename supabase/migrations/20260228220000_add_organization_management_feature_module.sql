INSERT INTO public.feature_modules (key, name, description, category, sort_order, is_active)
VALUES (
  'organization_management',
  'Organization Management',
  'Access to organization-level company management, including multi-company user assignment.',
  'general',
  350,
  true
)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

