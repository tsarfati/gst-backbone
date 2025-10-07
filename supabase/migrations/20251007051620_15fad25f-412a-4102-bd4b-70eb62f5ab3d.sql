-- Backfill cost codes to punch in records from their corresponding punch out records
-- This fixes punch ins made today that don't have a cost code but their punch out does

UPDATE punch_records AS pin
SET cost_code_id = pout.cost_code_id
FROM punch_records AS pout
WHERE pin.punch_type = 'punched_in'
  AND pout.punch_type = 'punched_out'
  AND pin.user_id = pout.user_id
  AND pin.job_id = pout.job_id
  AND pin.cost_code_id IS NULL
  AND pout.cost_code_id IS NOT NULL
  AND pin.punch_time >= CURRENT_DATE  -- Only today's records
  AND pout.punch_time > pin.punch_time
  AND pout.punch_time <= pin.punch_time + INTERVAL '24 hours'
  AND NOT EXISTS (
    -- Make sure there's no other punch out between them
    SELECT 1 FROM punch_records AS other
    WHERE other.user_id = pin.user_id
      AND other.punch_type = 'punched_out'
      AND other.punch_time > pin.punch_time
      AND other.punch_time < pout.punch_time
  );