-- Auto-detected / manual inter-sheet plan links (hotspots)
CREATE TABLE IF NOT EXISTS public.plan_page_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.job_plans(id) ON DELETE CASCADE,
  source_page_number INTEGER NOT NULL,
  target_page_number INTEGER NOT NULL,
  ref_text TEXT NOT NULL,
  target_sheet_number TEXT,
  target_title TEXT,
  x_norm DOUBLE PRECISION NOT NULL,
  y_norm DOUBLE PRECISION NOT NULL,
  w_norm DOUBLE PRECISION NOT NULL,
  h_norm DOUBLE PRECISION NOT NULL,
  confidence DOUBLE PRECISION,
  is_auto BOOLEAN NOT NULL DEFAULT true,
  link_key TEXT NOT NULL UNIQUE,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plan_page_links_plan_id ON public.plan_page_links(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_page_links_plan_source_page ON public.plan_page_links(plan_id, source_page_number);
CREATE INDEX IF NOT EXISTS idx_plan_page_links_plan_target_page ON public.plan_page_links(plan_id, target_page_number);

ALTER TABLE public.plan_page_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view plan links for their company jobs" ON public.plan_page_links;
CREATE POLICY "Users can view plan links for their company jobs"
ON public.plan_page_links
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.job_plans jp
    JOIN public.jobs j ON j.id = jp.job_id
    WHERE jp.id = plan_page_links.plan_id
      AND j.company_id IN (
        SELECT company_id FROM public.get_user_companies(auth.uid())
      )
  )
);

DROP POLICY IF EXISTS "Admins/controllers can manage plan links" ON public.plan_page_links;
CREATE POLICY "Admins/controllers can manage plan links"
ON public.plan_page_links
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.job_plans jp
    JOIN public.jobs j ON j.id = jp.job_id
    WHERE jp.id = plan_page_links.plan_id
      AND j.company_id IN (
        SELECT uc.company_id
        FROM public.get_user_companies(auth.uid()) AS uc(company_id, company_name, role)
        WHERE uc.role = ANY (ARRAY['admin'::public.user_role, 'controller'::public.user_role, 'project_manager'::public.user_role])
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.job_plans jp
    JOIN public.jobs j ON j.id = jp.job_id
    WHERE jp.id = plan_page_links.plan_id
      AND j.company_id IN (
        SELECT uc.company_id
        FROM public.get_user_companies(auth.uid()) AS uc(company_id, company_name, role)
        WHERE uc.role = ANY (ARRAY['admin'::public.user_role, 'controller'::public.user_role, 'project_manager'::public.user_role])
      )
  )
);

CREATE OR REPLACE FUNCTION public.trg_set_plan_page_links_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plan_page_links_updated_at ON public.plan_page_links;
CREATE TRIGGER trg_plan_page_links_updated_at
BEFORE UPDATE ON public.plan_page_links
FOR EACH ROW
EXECUTE FUNCTION public.trg_set_plan_page_links_updated_at();
