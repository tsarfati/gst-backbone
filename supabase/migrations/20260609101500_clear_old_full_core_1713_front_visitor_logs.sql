DO $$
DECLARE
  deleted_count integer := 0;
BEGIN
  DELETE FROM public.visitor_logs vl
  USING public.jobs j
  JOIN public.companies c ON c.id = j.company_id
  WHERE vl.job_id = j.id
    AND j.name IN ('1713 N Front St', '1713 North Front Street')
    AND (
      c.name = 'Full Core Construction Company'
      OR c.display_name = 'Full Core Construction Company'
    )
    AND vl.check_in_time < TIMESTAMPTZ '2026-06-06 00:00:00-04:00';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RAISE NOTICE 'Deleted % visitor_logs rows for Full Core Construction Company / 1713 N Front St before 2026-06-06 ET', deleted_count;
END $$;
