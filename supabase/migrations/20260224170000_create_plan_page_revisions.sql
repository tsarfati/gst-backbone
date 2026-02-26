-- Per-sheet revision history for plan viewer page/revision switching.
-- This supports multiple revisions for the same sheet number within a plan set.

CREATE TABLE IF NOT EXISTS public.plan_page_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.job_plans(id) ON DELETE CASCADE,
  target_page_number integer NOT NULL,
  sheet_number text NULL,
  normalized_sheet_key text NOT NULL,
  revision_label text NOT NULL DEFAULT 'Revision 1',
  revision_sort integer NULL DEFAULT 1,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plan_page_revisions_target_page_positive CHECK (target_page_number > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_page_revisions_unique_target
  ON public.plan_page_revisions (plan_id, normalized_sheet_key, revision_label, target_page_number);

CREATE INDEX IF NOT EXISTS idx_plan_page_revisions_plan_sheet
  ON public.plan_page_revisions (plan_id, normalized_sheet_key, revision_sort DESC, created_at DESC);

ALTER TABLE public.plan_page_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view plan page revisions for accessible plans" ON public.plan_page_revisions;
CREATE POLICY "Users can view plan page revisions for accessible plans"
ON public.plan_page_revisions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.job_plans jp
    WHERE jp.id = plan_page_revisions.plan_id
      AND (
        COALESCE(public.is_super_admin(auth.uid()), false)
        OR jp.company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
      )
  )
);

DROP POLICY IF EXISTS "Users can manage plan page revisions for accessible plans" ON public.plan_page_revisions;
CREATE POLICY "Users can manage plan page revisions for accessible plans"
ON public.plan_page_revisions
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.job_plans jp
    WHERE jp.id = plan_page_revisions.plan_id
      AND (
        COALESCE(public.is_super_admin(auth.uid()), false)
        OR jp.company_id IN (
          SELECT uc.company_id
          FROM public.get_user_companies(auth.uid()) uc
          WHERE uc.role = ANY (ARRAY['admin'::public.user_role, 'controller'::public.user_role, 'project_manager'::public.user_role])
        )
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.job_plans jp
    WHERE jp.id = plan_page_revisions.plan_id
      AND (
        COALESCE(public.is_super_admin(auth.uid()), false)
        OR jp.company_id IN (
          SELECT uc.company_id
          FROM public.get_user_companies(auth.uid()) uc
          WHERE uc.role = ANY (ARRAY['admin'::public.user_role, 'controller'::public.user_role, 'project_manager'::public.user_role])
        )
      )
  )
);

DROP TRIGGER IF EXISTS update_plan_page_revisions_updated_at ON public.plan_page_revisions;
CREATE TRIGGER update_plan_page_revisions_updated_at
BEFORE UPDATE ON public.plan_page_revisions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed current page rows as "Revision 1" (or existing plan revision label) so the viewer
-- can display a revision dropdown immediately even before historical revisions are added.
INSERT INTO public.plan_page_revisions (
  plan_id,
  target_page_number,
  sheet_number,
  normalized_sheet_key,
  revision_label,
  revision_sort,
  is_current
)
SELECT
  pp.plan_id,
  pp.page_number,
  pp.sheet_number,
  COALESCE(
    NULLIF(upper(regexp_replace(COALESCE(pp.sheet_number, ''), '[^A-Za-z0-9.]', '', 'g')), ''),
    'PAGE' || pp.page_number::text
  ) AS normalized_sheet_key,
  COALESCE(NULLIF(jp.revision, ''), 'Revision 1') AS revision_label,
  1 AS revision_sort,
  true AS is_current
FROM public.plan_pages pp
JOIN public.job_plans jp ON jp.id = pp.plan_id
ON CONFLICT DO NOTHING;

