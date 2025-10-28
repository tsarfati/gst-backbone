-- Create trigger function to automatically add punch clock photos to employee album
-- Only adds photos for users with profiles (not PIN employees without profiles)
CREATE OR REPLACE FUNCTION public.add_punch_photo_to_album()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  employee_album_id UUID;
  actual_user_id UUID;
  user_exists BOOLEAN;
BEGIN
  -- Only process if there's a photo_url and a job_id
  IF NEW.photo_url IS NOT NULL AND NEW.job_id IS NOT NULL THEN
    
    -- Determine the actual user_id (only use user_id, not pin_employee_id)
    -- PIN employees don't have profiles, so we skip them for now
    actual_user_id := NEW.user_id;
    
    IF actual_user_id IS NOT NULL THEN
      -- Check if user exists in profiles table
      SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = actual_user_id) INTO user_exists;
      
      IF user_exists THEN
        -- Get or create employee uploads album for this job
        SELECT get_or_create_employee_album(NEW.job_id, actual_user_id) INTO employee_album_id;
        
        -- Insert photo into job_photos table
        INSERT INTO public.job_photos (
          job_id,
          uploaded_by,
          photo_url,
          album_id,
          location_lat,
          location_lng,
          note
        ) VALUES (
          NEW.job_id,
          actual_user_id,
          NEW.photo_url,
          employee_album_id,
          NEW.latitude,
          NEW.longitude,
          CASE 
            WHEN NEW.punch_type = 'punched_in' THEN 'Punch In Photo'
            WHEN NEW.punch_type = 'punched_out' THEN 'Punch Out Photo'
            ELSE 'Punch Clock Photo'
          END
        )
        -- Avoid duplicates if photo_url already exists
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to fire after punch record insert
DROP TRIGGER IF EXISTS add_punch_photo_to_album_trigger ON public.punch_records;
CREATE TRIGGER add_punch_photo_to_album_trigger
  AFTER INSERT ON public.punch_records
  FOR EACH ROW
  EXECUTE FUNCTION public.add_punch_photo_to_album();

-- Backfill existing punch photos into job_photos (only for users with profiles)
DO $$
DECLARE
  punch_rec RECORD;
  employee_album_id UUID;
  user_exists BOOLEAN;
BEGIN
  FOR punch_rec IN 
    SELECT pr.id, pr.job_id, pr.user_id, pr.photo_url, 
           pr.latitude, pr.longitude, pr.punch_type
    FROM public.punch_records pr
    WHERE pr.photo_url IS NOT NULL 
      AND pr.job_id IS NOT NULL
      AND pr.user_id IS NOT NULL
      AND pr.photo_url NOT IN (SELECT photo_url FROM public.job_photos WHERE photo_url IS NOT NULL)
  LOOP
    -- Check if user exists in profiles
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE user_id = punch_rec.user_id) INTO user_exists;
    
    IF user_exists THEN
      -- Get or create employee album
      SELECT get_or_create_employee_album(punch_rec.job_id, punch_rec.user_id) INTO employee_album_id;
      
      -- Insert photo
      INSERT INTO public.job_photos (
        job_id,
        uploaded_by,
        photo_url,
        album_id,
        location_lat,
        location_lng,
        note
      ) VALUES (
        punch_rec.job_id,
        punch_rec.user_id,
        punch_rec.photo_url,
        employee_album_id,
        punch_rec.latitude,
        punch_rec.longitude,
        CASE 
          WHEN punch_rec.punch_type = 'punched_in' THEN 'Punch In Photo'
          WHEN punch_rec.punch_type = 'punched_out' THEN 'Punch Out Photo'
          ELSE 'Punch Clock Photo'
        END
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$;