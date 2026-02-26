-- Per-employee punch-in distance restriction (geofence) settings
ALTER TABLE public.employee_timecard_settings
ADD COLUMN IF NOT EXISTS enforce_punch_in_distance BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS punch_in_distance_limit_meters INTEGER NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'employee_timecard_settings_punch_in_distance_limit_check'
  ) THEN
    ALTER TABLE public.employee_timecard_settings
      ADD CONSTRAINT employee_timecard_settings_punch_in_distance_limit_check
      CHECK (
        punch_in_distance_limit_meters IS NULL
        OR punch_in_distance_limit_meters IN (10, 50, 100, 300)
      );
  END IF;
END $$;

