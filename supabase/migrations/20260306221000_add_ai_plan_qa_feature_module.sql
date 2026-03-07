INSERT INTO public.feature_modules (key, name, description, category, sort_order, is_active)
VALUES (
  'ai_plan_qa_v1',
  'A-RFI',
  'Enables A-RFI for plan sheet questions with citations in Plan Viewer.',
  'construction',
  1261,
  true
)
ON CONFLICT (key) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
