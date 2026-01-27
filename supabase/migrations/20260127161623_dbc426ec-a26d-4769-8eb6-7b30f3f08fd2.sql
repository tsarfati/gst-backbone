-- Backfill missing company_id for PIN employees from their timecard settings
UPDATE public.pin_employees pe
SET company_id = s.company_id
FROM public.pin_employee_timecard_settings s
WHERE pe.company_id IS NULL
  AND s.company_id IS NOT NULL
  AND s.pin_employee_id = pe.id;

-- Fallback: if still missing, infer company_id from the most recent punch record
WITH latest_company AS (
  SELECT DISTINCT ON (emp_id)
    emp_id,
    company_id
  FROM (
    SELECT COALESCE(pin_employee_id, user_id) AS emp_id,
           company_id,
           punch_time
    FROM public.punch_records
    WHERE company_id IS NOT NULL
      AND (pin_employee_id IS NOT NULL OR user_id IS NOT NULL)
  ) t
  WHERE emp_id IS NOT NULL
  ORDER BY emp_id, punch_time DESC
)
UPDATE public.pin_employees pe
SET company_id = lc.company_id
FROM latest_company lc
WHERE pe.company_id IS NULL
  AND pe.id = lc.emp_id;

-- Ensure Michael Sigma specifically is assigned (safety net)
UPDATE public.pin_employees
SET company_id = 'f64fff8d-16f4-4a07-81b3-e470d7e2d560'
WHERE id = 'a8d1dfe8-2f9c-4c23-ad23-58517fd2b318'
  AND company_id IS NULL;