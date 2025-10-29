-- Create helper function if missing
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create plan_pages table
CREATE TABLE IF NOT EXISTS public.plan_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL,
  page_number INTEGER NOT NULL,
  page_title TEXT,
  page_description TEXT,
  sheet_number TEXT,
  discipline TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Basic indexing
CREATE INDEX IF NOT EXISTS idx_plan_pages_plan_id ON public.plan_pages(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_pages_plan_id_page_number ON public.plan_pages(plan_id, page_number);

-- Enable RLS
ALTER TABLE public.plan_pages ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view plan pages for their companies" ON public.plan_pages;
CREATE POLICY "Users can view plan pages for their companies"
ON public.plan_pages
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM job_plans jp
    WHERE jp.id = plan_pages.plan_id
      AND jp.company_id IN (
        SELECT uc.company_id FROM get_user_companies(auth.uid()) AS uc(company_id, company_name, role)
      )
  )
);

DROP POLICY IF EXISTS "Admins/controllers can manage plan pages" ON public.plan_pages;
CREATE POLICY "Admins/controllers can manage plan pages"
ON public.plan_pages
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM job_plans jp
    WHERE jp.id = plan_pages.plan_id
      AND jp.company_id IN (
        SELECT uc.company_id FROM get_user_companies(auth.uid()) AS uc(company_id, company_name, role)
        WHERE uc.role = ANY(ARRAY['admin'::user_role, 'controller'::user_role])
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM job_plans jp
    WHERE jp.id = plan_pages.plan_id
      AND jp.company_id IN (
        SELECT uc.company_id FROM get_user_companies(auth.uid()) AS uc(company_id, company_name, role)
        WHERE uc.role = ANY(ARRAY['admin'::user_role, 'controller'::user_role])
      )
  )
);

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS trg_plan_pages_updated_at ON public.plan_pages;
CREATE TRIGGER trg_plan_pages_updated_at
BEFORE UPDATE ON public.plan_pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();