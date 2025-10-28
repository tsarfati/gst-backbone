-- Function to insert job photos for PIN mode by proxying uploader to a valid profile user
CREATE OR REPLACE FUNCTION public.pin_insert_job_photo(
  p_job_id uuid,
  p_uploader_hint uuid,
  p_photo_url text,
  p_note text,
  p_location_lat numeric,
  p_location_lng numeric
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_uploader_id uuid;
  v_album_id uuid;
  v_new_id uuid;
BEGIN
  -- Validate inputs
  IF p_job_id IS NULL OR p_photo_url IS NULL THEN
    RAISE EXCEPTION 'job_id and photo_url are required';
  END IF;

  -- Get company for the job
  SELECT company_id INTO v_company_id FROM public.jobs WHERE id = p_job_id;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Invalid job_id %', p_job_id;
  END IF;

  -- Prefer the hint if it exists in profiles
  SELECT user_id INTO v_uploader_id FROM public.profiles WHERE user_id = p_uploader_hint;

  -- If no valid hint, pick a company admin/controller/project_manager
  IF v_uploader_id IS NULL THEN
    SELECT uca.user_id
    INTO v_uploader_id
    FROM public.user_company_access uca
    WHERE uca.company_id = v_company_id AND uca.is_active = true
    ORDER BY CASE uca.role
      WHEN 'admin' THEN 1
      WHEN 'controller' THEN 2
      WHEN 'project_manager' THEN 3
      ELSE 100
    END
    LIMIT 1;
  END IF;

  IF v_uploader_id IS NULL THEN
    RAISE EXCEPTION 'No eligible uploader found for company %', v_company_id;
  END IF;

  -- Ensure album exists for this uploader and job
  SELECT get_or_create_employee_album(p_job_id, v_uploader_id) INTO v_album_id;

  -- Insert into job_photos
  INSERT INTO public.job_photos (
    job_id, uploaded_by, photo_url, album_id, location_lat, location_lng, note
  ) VALUES (
    p_job_id, v_uploader_id, p_photo_url, v_album_id, p_location_lat, p_location_lng, NULLIF(trim(p_note), '')
  ) RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.pin_insert_job_photo(uuid, uuid, text, text, numeric, numeric) TO anon, authenticated;