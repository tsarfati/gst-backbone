
ALTER TABLE public.pm_mobile_settings
ADD COLUMN IF NOT EXISTS background_image_url text,
ADD COLUMN IF NOT EXISTS container_opacity numeric(3,2) DEFAULT 1.0;
