-- Add shift timing settings to jobs table
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS shift_start_time time,
ADD COLUMN IF NOT EXISTS shift_end_time time,
ADD COLUMN IF NOT EXISTS count_early_punch_in boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS early_punch_in_grace_minutes integer DEFAULT 15,
ADD COLUMN IF NOT EXISTS count_late_punch_out boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS late_punch_out_grace_minutes integer DEFAULT 15;

COMMENT ON COLUMN public.jobs.shift_start_time IS 'Standard shift start time for this job';
COMMENT ON COLUMN public.jobs.shift_end_time IS 'Standard shift end time for this job';
COMMENT ON COLUMN public.jobs.count_early_punch_in IS 'Whether to count time before shift start';
COMMENT ON COLUMN public.jobs.early_punch_in_grace_minutes IS 'Minutes before shift start that early punch-in is allowed';
COMMENT ON COLUMN public.jobs.count_late_punch_out IS 'Whether to count time after shift end';
COMMENT ON COLUMN public.jobs.late_punch_out_grace_minutes IS 'Minutes after shift end that late punch-out is allowed';

-- Update the time card creation trigger to respect shift times
CREATE OR REPLACE FUNCTION public.create_time_card_from_punch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  punch_in_record RECORD;
  total_hours_calc NUMERIC;
  overtime_calc NUMERIC;
  break_deduction INTEGER := 0;
  job_company_id UUID;
  job_shift_start TIME;
  job_shift_end TIME;
  count_early_punch BOOLEAN;
  early_grace_minutes INTEGER;
  count_late_punch BOOLEAN;
  late_grace_minutes INTEGER;
  adjusted_punch_in TIMESTAMP WITH TIME ZONE;
  adjusted_punch_out TIMESTAMP WITH TIME ZONE;
  shift_start_datetime TIMESTAMP WITH TIME ZONE;
  shift_end_datetime TIMESTAMP WITH TIME ZONE;
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
      -- Get company_id and shift settings from the job
      SELECT 
        company_id,
        shift_start_time,
        shift_end_time,
        COALESCE(count_early_punch_in, false),
        COALESCE(early_punch_in_grace_minutes, 15),
        COALESCE(count_late_punch_out, true),
        COALESCE(late_punch_out_grace_minutes, 15)
      INTO 
        job_company_id,
        job_shift_start,
        job_shift_end,
        count_early_punch,
        early_grace_minutes,
        count_late_punch,
        late_grace_minutes
      FROM public.jobs
      WHERE id = NEW.job_id;
      
      -- Start with actual punch times
      adjusted_punch_in := punch_in_record.punch_time;
      adjusted_punch_out := NEW.punch_time;
      
      -- Apply shift time rules if shift times are configured
      IF job_shift_start IS NOT NULL AND job_shift_end IS NOT NULL THEN
        -- Create shift start/end timestamps for the punch date
        shift_start_datetime := date_trunc('day', punch_in_record.punch_time) + job_shift_start;
        shift_end_datetime := date_trunc('day', NEW.punch_time) + job_shift_end;
        
        -- Handle overnight shifts (shift end is next day)
        IF job_shift_end < job_shift_start THEN
          shift_end_datetime := shift_end_datetime + interval '1 day';
        END IF;
        
        -- Early punch-in handling
        IF punch_in_record.punch_time < shift_start_datetime THEN
          -- Check if within grace period
          IF punch_in_record.punch_time >= (shift_start_datetime - (early_grace_minutes || ' minutes')::interval) THEN
            -- Within grace period
            IF NOT count_early_punch THEN
              -- Don't count early time, start at shift start
              adjusted_punch_in := shift_start_datetime;
            END IF;
            -- If count_early_punch is true, keep actual punch time
          ELSE
            -- Outside grace period, always start at shift start
            adjusted_punch_in := shift_start_datetime;
          END IF;
        END IF;
        
        -- Late punch-out handling
        IF NEW.punch_time > shift_end_datetime THEN
          -- Check if within grace period
          IF NEW.punch_time <= (shift_end_datetime + (late_grace_minutes || ' minutes')::interval) THEN
            -- Within grace period
            IF NOT count_late_punch THEN
              -- Don't count late time, end at shift end
              adjusted_punch_out := shift_end_datetime;
            END IF;
            -- If count_late_punch is true, keep actual punch time
          ELSE
            -- Outside grace period, cap at shift end + grace
            adjusted_punch_out := shift_end_datetime + (late_grace_minutes || ' minutes')::interval;
          END IF;
        END IF;
      END IF;
      
      -- Calculate total hours with adjusted times
      total_hours_calc := EXTRACT(EPOCH FROM (adjusted_punch_out - adjusted_punch_in)) / 3600.0;
      
      -- Apply automatic break deduction for shifts over 6 hours
      IF total_hours_calc > 6 THEN
        break_deduction := 30; -- 30 minute break
        total_hours_calc := total_hours_calc - 0.5;
      END IF;
      
      -- Calculate overtime (hours over 8 per day)
      overtime_calc := GREATEST(0, total_hours_calc - 8);
      
      -- Create time card entry - mark as approved since it's from punch clock
      INSERT INTO public.time_cards (
        user_id,
        company_id,
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
        status,
        created_via_punch_clock
      ) VALUES (
        NEW.user_id,
        job_company_id,
        NEW.job_id,
        NEW.cost_code_id,
        adjusted_punch_in,
        adjusted_punch_out,
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
        'approved',
        true
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;