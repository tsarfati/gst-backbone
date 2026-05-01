ALTER TABLE public.job_photos
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
