-- Update function to use SECURITY DEFINER and fix realtime
CREATE OR REPLACE FUNCTION get_or_create_employee_album(p_job_id UUID, p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_album_id UUID;
BEGIN
  -- Try to find existing employee album
  SELECT id INTO v_album_id
  FROM photo_albums
  WHERE job_id = p_job_id AND is_auto_employee_album = true
  LIMIT 1;

  -- Create if doesn't exist
  IF v_album_id IS NULL THEN
    INSERT INTO photo_albums (job_id, name, description, created_by, is_auto_employee_album)
    VALUES (p_job_id, 'Employee Uploads', 'Automatic album for employee-uploaded photos', p_user_id, true)
    RETURNING id INTO v_album_id;
  END IF;

  RETURN v_album_id;
END;
$$;

-- Enable realtime for photo_albums and job_photos
ALTER TABLE photo_albums REPLICA IDENTITY FULL;
ALTER TABLE job_photos REPLICA IDENTITY FULL;
ALTER TABLE photo_comments REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE photo_albums;
ALTER PUBLICATION supabase_realtime ADD TABLE job_photos;
ALTER PUBLICATION supabase_realtime ADD TABLE photo_comments;