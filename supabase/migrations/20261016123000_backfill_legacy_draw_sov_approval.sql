-- Jobs with draws created before the SOV approval workflow was introduced can
-- have locked SOV rows that still say "draft". Treat the first existing draw
-- as the approval event so later draws are not blocked by an impossible state.

ALTER TABLE public.schedule_of_values
  DISABLE TRIGGER enforce_schedule_of_values_workflow_trigger;

WITH first_draw AS (
  SELECT DISTINCT ON (job_id)
    job_id,
    created_at,
    created_by
  FROM public.ar_invoices
  WHERE job_id IS NOT NULL
  ORDER BY job_id, application_number NULLS LAST, created_at, id
)
UPDATE public.schedule_of_values AS sov
SET
  workflow_status = 'approved',
  approved_at = COALESCE(sov.approved_at, first_draw.created_at),
  approved_by = COALESCE(sov.approved_by, first_draw.created_by)
FROM first_draw
WHERE sov.job_id = first_draw.job_id
  AND sov.is_active = true
  AND sov.workflow_status = 'draft';

ALTER TABLE public.schedule_of_values
  ENABLE TRIGGER enforce_schedule_of_values_workflow_trigger;
