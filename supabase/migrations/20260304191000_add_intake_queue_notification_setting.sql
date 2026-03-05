ALTER TABLE public.notification_settings
ADD COLUMN IF NOT EXISTS intake_queue_requests boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.notification_settings.intake_queue_requests
IS 'When true, the user receives intake queue pending-approval notifications.';
