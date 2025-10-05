-- Create a function to automatically log out visitors who have exceeded their time limit
CREATE OR REPLACE FUNCTION public.auto_logout_visitors()
RETURNS TABLE(logged_out_count INTEGER, job_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_logged_out INTEGER := 0;
BEGIN
  -- Update visitor_logs to check out visitors who have exceeded the auto logout time
  WITH logged_out AS (
    UPDATE public.visitor_logs vl
    SET 
      check_out_time = NOW(),
      updated_at = NOW()
    FROM public.visitor_auto_logout_settings vals
    WHERE vl.job_id = vals.job_id
      AND vl.check_out_time IS NULL -- Only visitors still checked in
      AND vals.auto_logout_enabled = true
      AND NOW() > (vl.check_in_time + (vals.auto_logout_hours || ' hours')::INTERVAL)
    RETURNING vl.id, vl.job_id
  )
  SELECT COUNT(*)::INTEGER, lo.job_id
  INTO total_logged_out, job_id
  FROM logged_out lo
  GROUP BY lo.job_id;
  
  RETURN QUERY
  SELECT total_logged_out, job_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.auto_logout_visitors() TO authenticated;