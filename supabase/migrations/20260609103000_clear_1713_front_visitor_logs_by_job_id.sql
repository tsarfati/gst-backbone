DO $$
DECLARE
  target_job_id CONSTANT uuid := 'e7f9a962-71d7-4bdb-a6f8-53f730493f4f';
  deleted_count integer := 0;
BEGIN
  DELETE FROM public.visitor_logs
  WHERE job_id = target_job_id
    AND check_in_time < TIMESTAMPTZ '2026-06-06 00:00:00-04:00';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Deleted % visitor_logs rows for job % before 2026-06-06 ET', deleted_count, target_job_id;
END $$;
