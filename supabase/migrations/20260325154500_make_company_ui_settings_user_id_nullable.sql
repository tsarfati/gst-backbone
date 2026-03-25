-- company_ui_settings now stores both:
-- 1) shared company settings rows (user_id IS NULL)
-- 2) legacy/user-scoped settings rows (user_id = auth.uid())
--
-- Some environments still have the original NOT NULL constraint on user_id,
-- which blocks shared company settings from being saved. Make the column
-- nullable explicitly and replace the original UNIQUE(company_id, user_id)
-- constraint with partial unique indexes that support one shared row per company.

ALTER TABLE public.company_ui_settings
  ALTER COLUMN user_id DROP NOT NULL;

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname
  INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'company_ui_settings'
    AND con.contype = 'u'
    AND pg_get_constraintdef(con.oid) LIKE '%company_id, user_id%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.company_ui_settings DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS company_ui_settings_company_user_unique
  ON public.company_ui_settings (company_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS company_ui_settings_company_default_unique
  ON public.company_ui_settings (company_id)
  WHERE user_id IS NULL;
