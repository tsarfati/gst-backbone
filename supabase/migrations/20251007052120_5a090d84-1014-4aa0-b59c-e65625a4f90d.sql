-- Backfill today's punch_in, current status, and time_cards with employee default cost codes when missing

-- 1) Update active current_punch_status entries (punch ins still active)
UPDATE current_punch_status cps
SET cost_code_id = ets.default_cost_code_id
FROM employee_timecard_settings ets
WHERE cps.is_active = true
  AND cps.cost_code_id IS NULL
  AND ets.user_id = cps.user_id
  AND (ets.company_id IS NULL OR ets.company_id = (SELECT company_id FROM jobs WHERE id = cps.job_id LIMIT 1))
  AND ets.default_cost_code_id IS NOT NULL;

-- 2) Update today's punched_in records missing cost code
UPDATE punch_records pin
SET cost_code_id = ets.default_cost_code_id
FROM employee_timecard_settings ets
WHERE pin.punch_type = 'punched_in'
  AND pin.punch_time >= (now() - interval '36 hours')
  AND pin.cost_code_id IS NULL
  AND ets.user_id = pin.user_id
  AND (ets.company_id IS NULL OR ets.company_id = pin.company_id)
  AND ets.default_cost_code_id IS NOT NULL;

-- 3) Update today's time_cards missing cost code
UPDATE time_cards tc
SET cost_code_id = ets.default_cost_code_id
FROM employee_timecard_settings ets
WHERE tc.punch_in_time >= (now() - interval '36 hours')
  AND tc.cost_code_id IS NULL
  AND ets.user_id = tc.user_id
  AND (ets.company_id IS NULL OR ets.company_id = tc.company_id)
  AND ets.default_cost_code_id IS NOT NULL;