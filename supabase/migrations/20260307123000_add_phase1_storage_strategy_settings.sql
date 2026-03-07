-- Phase 1 storage strategy fields (BuilderLink default + BYOS + backup routing)
ALTER TABLE public.file_upload_settings
  ADD COLUMN IF NOT EXISTS primary_storage_provider TEXT NOT NULL DEFAULT 'builderlink',
  ADD COLUMN IF NOT EXISTS heavy_files_storage_provider TEXT NOT NULL DEFAULT 'builderlink',
  ADD COLUMN IF NOT EXISTS enable_backup_copy BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS backup_storage_provider TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS backup_heavy_files_only BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS backup_plans BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS backup_photos BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS backup_receipts BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS backup_bills BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS backup_company_files BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_storage_test_provider TEXT,
  ADD COLUMN IF NOT EXISTS last_storage_test_status TEXT,
  ADD COLUMN IF NOT EXISTS last_storage_test_message TEXT,
  ADD COLUMN IF NOT EXISTS last_storage_tested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS storage_test_results JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'file_upload_settings_primary_storage_provider_check'
  ) THEN
    ALTER TABLE public.file_upload_settings
      ADD CONSTRAINT file_upload_settings_primary_storage_provider_check
      CHECK (primary_storage_provider IN ('builderlink', 'google_drive', 'onedrive', 'ftp'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'file_upload_settings_heavy_files_storage_provider_check'
  ) THEN
    ALTER TABLE public.file_upload_settings
      ADD CONSTRAINT file_upload_settings_heavy_files_storage_provider_check
      CHECK (heavy_files_storage_provider IN ('builderlink', 'google_drive', 'onedrive', 'ftp'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'file_upload_settings_backup_storage_provider_check'
  ) THEN
    ALTER TABLE public.file_upload_settings
      ADD CONSTRAINT file_upload_settings_backup_storage_provider_check
      CHECK (backup_storage_provider IN ('none', 'google_drive', 'onedrive', 'ftp'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'file_upload_settings_last_storage_test_status_check'
  ) THEN
    ALTER TABLE public.file_upload_settings
      ADD CONSTRAINT file_upload_settings_last_storage_test_status_check
      CHECK (last_storage_test_status IS NULL OR last_storage_test_status IN ('success', 'warning', 'failed'));
  END IF;
END$$;

COMMENT ON COLUMN public.file_upload_settings.primary_storage_provider
  IS 'Primary file storage provider. Default is builderlink (Supabase Storage).';
COMMENT ON COLUMN public.file_upload_settings.heavy_files_storage_provider
  IS 'Provider used for heavy assets (plans/photos/videos).';
COMMENT ON COLUMN public.file_upload_settings.enable_backup_copy
  IS 'If true, files are copied to a secondary backup provider.';
COMMENT ON COLUMN public.file_upload_settings.backup_storage_provider
  IS 'Backup destination provider. none disables backup copy.';
COMMENT ON COLUMN public.file_upload_settings.storage_test_results
  IS 'Per-provider test results JSON keyed by provider name.';
