-- Create time cards from existing punch record pairs for PIN employees
-- This is a one-time backfill for punch records that don't have corresponding time cards

DO $$
DECLARE
  punch_in_rec RECORD;
  punch_out_rec RECORD;
  total_hours_calc NUMERIC;
  overtime_calc NUMERIC;
  break_deduction INTEGER := 0;
BEGIN
  -- Find all punch-in records from today that don't have a corresponding time card
  FOR punch_in_rec IN
    SELECT pr.*
    FROM punch_records pr
    WHERE pr.punch_type = 'punched_in'
      AND DATE(pr.punch_time) = CURRENT_DATE
      AND NOT EXISTS (
        SELECT 1 FROM time_cards tc
        WHERE tc.punch_in_time = pr.punch_time
          AND tc.user_id = pr.user_id
      )
    ORDER BY pr.punch_time
  LOOP
    -- Find the matching punch-out record
    SELECT * INTO punch_out_rec
    FROM punch_records
    WHERE user_id = punch_in_rec.user_id
      AND punch_type = 'punched_out'
      AND job_id IS NOT DISTINCT FROM punch_in_rec.job_id
      AND cost_code_id IS NOT DISTINCT FROM punch_in_rec.cost_code_id
      AND punch_time > punch_in_rec.punch_time
      AND DATE(punch_time) = CURRENT_DATE
    ORDER BY punch_time ASC
    LIMIT 1;
    
    -- If we found a matching punch-out, create the time card
    IF punch_out_rec.id IS NOT NULL THEN
      -- Calculate total hours
      total_hours_calc := EXTRACT(EPOCH FROM (punch_out_rec.punch_time - punch_in_rec.punch_time)) / 3600.0;
      
      -- Apply automatic break deduction for shifts over 6 hours
      IF total_hours_calc > 6 THEN
        break_deduction := 30;
        total_hours_calc := total_hours_calc - 0.5;
      ELSE
        break_deduction := 0;
      END IF;
      
      -- Calculate overtime (hours over 8 per day)
      overtime_calc := GREATEST(0, total_hours_calc - 8);
      
      -- Create time card entry
      INSERT INTO time_cards (
        user_id,
        job_id,
        cost_code_id,
        company_id,
        punch_in_time,
        punch_out_time,
        total_hours,
        overtime_hours,
        break_minutes,
        punch_in_location_lat,
        punch_in_location_lng,
        punch_out_location_lat,
        punch_out_location_lng,
        punch_in_photo_url,
        punch_out_photo_url,
        notes,
        status,
        created_via_punch_clock
      ) VALUES (
        punch_in_rec.user_id,
        punch_in_rec.job_id,
        punch_in_rec.cost_code_id,
        punch_in_rec.company_id,
        punch_in_rec.punch_time,
        punch_out_rec.punch_time,
        total_hours_calc,
        overtime_calc,
        break_deduction,
        punch_in_rec.latitude,
        punch_in_rec.longitude,
        punch_out_rec.latitude,
        punch_out_rec.longitude,
        punch_in_rec.photo_url,
        punch_out_rec.photo_url,
        punch_out_rec.notes,
        'approved',
        true
      );
      
      RAISE NOTICE 'Created time card for user % from % to %', 
        punch_in_rec.user_id, 
        punch_in_rec.punch_time, 
        punch_out_rec.punch_time;
    END IF;
  END LOOP;
END $$;