-- Data fix: Reassign Rodrigo's punches and time cards to Sigma > Job 115 N 3rd with cost code SUPERINTENDENT (01.24)
-- Context: User reported punches under wrong company (Greenstar) and unknown job/cost code.
-- Scope: 2025-10-03 through today (UTC) for user Rodrigo.

-- Constants (from lookups)
-- Sigma company id: f64fff8d-16f4-4a07-81b3-e470d7e2d560
-- Job 115 N 3rd id: cf42bcc1-d025-46b5-a40e-ecf6546a23d9
-- Cost Code SUPERINTENDENT (01.24) for Job 115 id: 0f47ca8a-9a3e-4940-af27-e611b0d4a40a
-- Rodrigo user id: d73909c6-a3a1-48f7-a63d-651b7c310e8d

BEGIN;

-- 1) Update punch_records: move any records for Rodrigo on/after 2025-10-03
--    that are currently linked to Greenstar jobs or have null job/cost code
--    to the Sigma Job 115 + Superintendent cost code
UPDATE public.punch_records pr
SET job_id = 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9',
    cost_code_id = '0f47ca8a-9a3e-4940-af27-e611b0d4a40a'
WHERE pr.user_id = 'd73909c6-a3a1-48f7-a63d-651b7c310e8d'
  AND pr.punch_time::date BETWEEN DATE '2025-10-03' AND CURRENT_DATE
  AND (
    pr.job_id IS NULL
    OR pr.job_id IN (
      SELECT j.id
      FROM public.jobs j
      JOIN public.companies comp ON comp.id = j.company_id
      WHERE comp.name ILIKE '%greenstar%'
    )
  );

-- 2) Update time_cards similarly for the same user/date range
UPDATE public.time_cards tc
SET job_id = 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9',
    cost_code_id = '0f47ca8a-9a3e-4940-af27-e611b0d4a40a'
WHERE tc.user_id = 'd73909c6-a3a1-48f7-a63d-651b7c310e8d'
  AND tc.punch_in_time::date BETWEEN DATE '2025-10-03' AND CURRENT_DATE
  AND (
    tc.job_id IS NULL
    OR tc.job_id IN (
      SELECT j.id
      FROM public.jobs j
      JOIN public.companies comp ON comp.id = j.company_id
      WHERE comp.name ILIKE '%greenstar%'
    )
  );

-- 3) Ensure current active punch status reflects the same job/cost code
UPDATE public.current_punch_status cps
SET job_id = 'cf42bcc1-d025-46b5-a40e-ecf6546a23d9',
    cost_code_id = '0f47ca8a-9a3e-4940-af27-e611b0d4a40a',
    updated_at = now()
WHERE cps.user_id = 'd73909c6-a3a1-48f7-a63d-651b7c310e8d'
  AND cps.is_active = true;

COMMIT;