-- Backfill time_cards cost_code_id for today's records using corresponding punch_out records
WITH out_for_card AS (
  SELECT 
    tc.id AS time_card_id,
    pr_out.cost_code_id,
    ROW_NUMBER() OVER (PARTITION BY tc.id ORDER BY pr_out.punch_time ASC) rn
  FROM time_cards tc
  JOIN punch_records pr_out
    ON pr_out.user_id = tc.user_id
   AND pr_out.job_id IS NOT DISTINCT FROM tc.job_id
   AND pr_out.punch_type = 'punched_out'
   AND pr_out.punch_time >= tc.punch_in_time
   AND pr_out.punch_time <= COALESCE(tc.punch_out_time, tc.punch_in_time + INTERVAL '24 hours')
  WHERE tc.punch_in_time >= CURRENT_DATE
    AND tc.cost_code_id IS NULL
    AND pr_out.cost_code_id IS NOT NULL
)
UPDATE time_cards tc
SET cost_code_id = o.cost_code_id
FROM out_for_card o
WHERE tc.id = o.time_card_id
  AND o.rn = 1;