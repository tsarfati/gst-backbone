-- Backfill missing cost codes using most recent prior time card for same user and job (scalar subselects)

-- 1) time_cards in last 36h missing cost code
UPDATE time_cards tc
SET cost_code_id = (
  SELECT t2.cost_code_id
  FROM time_cards t2
  WHERE t2.user_id = tc.user_id
    AND t2.job_id IS NOT DISTINCT FROM tc.job_id
    AND t2.cost_code_id IS NOT NULL
    AND t2.punch_in_time < tc.punch_in_time
  ORDER BY t2.punch_in_time DESC
  LIMIT 1
)
WHERE tc.punch_in_time >= (now() - interval '36 hours')
  AND tc.cost_code_id IS NULL
  AND (
    SELECT t2.cost_code_id FROM time_cards t2
    WHERE t2.user_id = tc.user_id
      AND t2.job_id IS NOT DISTINCT FROM tc.job_id
      AND t2.cost_code_id IS NOT NULL
      AND t2.punch_in_time < tc.punch_in_time
    ORDER BY t2.punch_in_time DESC
    LIMIT 1
  ) IS NOT NULL;

-- 2) punch_records punched_in in last 36h missing cost code
UPDATE punch_records pin
SET cost_code_id = (
  SELECT t2.cost_code_id
  FROM time_cards t2
  WHERE t2.user_id = pin.user_id
    AND t2.job_id IS NOT DISTINCT FROM pin.job_id
    AND t2.cost_code_id IS NOT NULL
    AND t2.punch_in_time < pin.punch_time
  ORDER BY t2.punch_in_time DESC
  LIMIT 1
)
WHERE pin.punch_type = 'punched_in'
  AND pin.punch_time >= (now() - interval '36 hours')
  AND pin.cost_code_id IS NULL
  AND (
    SELECT t2.cost_code_id
    FROM time_cards t2
    WHERE t2.user_id = pin.user_id
      AND t2.job_id IS NOT DISTINCT FROM pin.job_id
      AND t2.cost_code_id IS NOT NULL
      AND t2.punch_in_time < pin.punch_time
    ORDER BY t2.punch_in_time DESC
    LIMIT 1
  ) IS NOT NULL;

-- 3) current_punch_status active missing cost code
UPDATE current_punch_status cps
SET cost_code_id = (
  SELECT t2.cost_code_id
  FROM time_cards t2
  WHERE t2.user_id = cps.user_id
    AND t2.job_id IS NOT DISTINCT FROM cps.job_id
    AND t2.cost_code_id IS NOT NULL
  ORDER BY t2.punch_in_time DESC
  LIMIT 1
)
WHERE cps.is_active = true
  AND cps.cost_code_id IS NULL
  AND (
    SELECT t2.cost_code_id
    FROM time_cards t2
    WHERE t2.user_id = cps.user_id
      AND t2.job_id IS NOT DISTINCT FROM cps.job_id
      AND t2.cost_code_id IS NOT NULL
    ORDER BY t2.punch_in_time DESC
    LIMIT 1
  ) IS NOT NULL;