UPDATE public.feature_modules
SET
  name = 'A-RFI',
  description = 'Enables A-RFI for plan sheet questions with citations in Plan Viewer.',
  category = 'construction',
  is_active = true
WHERE key = 'ai_plan_qa_v1';
