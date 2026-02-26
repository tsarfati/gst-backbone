ALTER TABLE public.job_punch_clock_settings
ADD COLUMN IF NOT EXISTS warn_when_punch_outside_jobsite boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS outside_jobsite_warning_distance_meters integer NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'job_punch_clock_settings_outside_jobsite_warning_distance_check'
  ) THEN
    ALTER TABLE public.job_punch_clock_settings
    ADD CONSTRAINT job_punch_clock_settings_outside_jobsite_warning_distance_check
    CHECK (
      outside_jobsite_warning_distance_meters IS NULL
      OR outside_jobsite_warning_distance_meters IN (10, 50, 100, 300)
    );
  END IF;
END $$;

UPDATE public.job_punch_clock_settings
SET outside_jobsite_warning_distance_meters = 100
WHERE warn_when_punch_outside_jobsite = true
  AND outside_jobsite_warning_distance_meters IS NULL;
