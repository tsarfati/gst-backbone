-- Fix enum values in create_time_card_from_punch to match current punch_status enum
-- and avoid implicit casts causing errors
CREATE OR REPLACE FUNCTION public.create_time_card_from_punch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  punch_in_record RECORD;
  total_hours_calc NUMERIC;
  overtime_calc NUMERIC;
  break_deduction INTEGER := 0;
BEGIN
  -- Only process when a punch_out occurs
  IF NEW.punch_type = 'punched_out'::public.punch_status THEN
    -- Find the corresponding punch_in record
    SELECT * INTO punch_in_record
    FROM public.punch_records
    WHERE user_id = NEW.user_id
      AND punch_type = 'punched_in'::public.punch_status
      AND job_id IS NOT DISTINCT FROM NEW.job_id
      AND cost_code_id IS NOT DISTINCT FROM NEW.cost_code_id
      AND punch_time < NEW.punch_time
    ORDER BY punch_time DESC
    LIMIT 1;
    
    IF punch_in_record IS NOT NULL THEN
      -- Calculate total hours
      total_hours_calc := EXTRACT(EPOCH FROM (NEW.punch_time - punch_in_record.punch_time)) / 3600.0;
      
      -- Apply automatic break deduction for shifts over 6 hours
      IF total_hours_calc > 6 THEN
        break_deduction := 30; -- 30 minute break
        total_hours_calc := total_hours_calc - 0.5;
      END IF;
      
      -- Calculate overtime (hours over 8 per day)
      overtime_calc := GREATEST(0, total_hours_calc - 8);
      
      -- Create time card entry
      INSERT INTO public.time_cards (
        user_id,
        job_id,
        cost_code_id,
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
        status
      ) VALUES (
        NEW.user_id,
        NEW.job_id,
        NEW.cost_code_id,
        punch_in_record.punch_time,
        NEW.punch_time,
        total_hours_calc,
        overtime_calc,
        break_deduction,
        punch_in_record.latitude,
        punch_in_record.longitude,
        NEW.latitude,
        NEW.longitude,
        punch_in_record.photo_url,
        NEW.photo_url,
        NEW.notes,
        'approved'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;