-- Ensure only one row per company and allow upsert on company_id
-- 1) Remove duplicates (keep most recent per company)
WITH ranked AS (
  SELECT id, company_id, row_number() OVER (PARTITION BY company_id ORDER BY created_at DESC) AS rn
  FROM public.punch_clock_login_settings
)
DELETE FROM public.punch_clock_login_settings p
USING ranked r
WHERE p.id = r.id
  AND r.rn > 1;

-- 2) Add a unique constraint on company_id to support ON CONFLICT (company_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'punch_clock_login_settings_company_id_key'
  ) THEN
    ALTER TABLE public.punch_clock_login_settings
    ADD CONSTRAINT punch_clock_login_settings_company_id_key UNIQUE (company_id);
  END IF;
END $$;

-- 3) Add/ensure updated_at trigger uses shared function
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_punch_clock_login_settings_updated_at'
  ) THEN
    CREATE TRIGGER update_punch_clock_login_settings_updated_at
    BEFORE UPDATE ON public.punch_clock_login_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;