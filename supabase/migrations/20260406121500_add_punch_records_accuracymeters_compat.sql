ALTER TABLE public.punch_records
ADD COLUMN IF NOT EXISTS "accuracyMeters" numeric(10,2);

UPDATE public.punch_records
SET "accuracyMeters" = accuracy_meters
WHERE "accuracyMeters" IS NULL
  AND accuracy_meters IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_punch_record_accuracy_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.accuracy_meters IS NULL AND NEW."accuracyMeters" IS NOT NULL THEN
    NEW.accuracy_meters := NEW."accuracyMeters";
  ELSIF NEW.accuracy_meters IS NOT NULL AND NEW."accuracyMeters" IS NULL THEN
    NEW."accuracyMeters" := NEW.accuracy_meters;
  ELSIF NEW.accuracy_meters IS NOT NULL AND NEW."accuracyMeters" IS NOT NULL THEN
    NEW."accuracyMeters" := NEW.accuracy_meters;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_punch_record_accuracy_columns_trigger ON public.punch_records;

CREATE TRIGGER sync_punch_record_accuracy_columns_trigger
BEFORE INSERT OR UPDATE ON public.punch_records
FOR EACH ROW
EXECUTE FUNCTION public.sync_punch_record_accuracy_columns();

COMMENT ON COLUMN public.punch_records."accuracyMeters" IS
'Temporary compatibility column for older punch clock clients that still write camelCase accuracyMeters.';
