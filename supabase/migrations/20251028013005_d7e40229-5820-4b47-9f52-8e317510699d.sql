-- Remove the trigger that was adding punch in/out photos to albums
-- The PunchClockPhotoUpload component already handles manual photo uploads correctly
DROP TRIGGER IF EXISTS add_punch_photo_to_album_trigger ON public.punch_records;
DROP FUNCTION IF EXISTS public.add_punch_photo_to_album();

-- Remove any punch in/out photos that were incorrectly added to albums
DELETE FROM public.job_photos 
WHERE note IN ('Punch In Photo', 'Punch Out Photo', 'Punch Clock Photo')
  AND photo_url IN (SELECT photo_url FROM public.punch_records WHERE photo_url IS NOT NULL);