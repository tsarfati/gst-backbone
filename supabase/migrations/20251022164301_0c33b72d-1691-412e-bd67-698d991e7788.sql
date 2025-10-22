-- Clean up orphaned job_photos records and add foreign keys

-- Delete job_photos that don't have corresponding profiles
DELETE FROM public.job_photos
WHERE uploaded_by NOT IN (SELECT user_id FROM public.profiles);

-- Delete photo_comments that don't have corresponding profiles
DELETE FROM public.photo_comments
WHERE user_id NOT IN (SELECT user_id FROM public.profiles);

-- Add foreign key from job_photos.uploaded_by to profiles.user_id
ALTER TABLE public.job_photos
DROP CONSTRAINT IF EXISTS job_photos_uploaded_by_fkey;

ALTER TABLE public.job_photos
ADD CONSTRAINT job_photos_uploaded_by_fkey 
FOREIGN KEY (uploaded_by) 
REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;

-- Add foreign key from photo_comments.user_id to profiles.user_id
ALTER TABLE public.photo_comments
DROP CONSTRAINT IF EXISTS photo_comments_user_id_fkey;

ALTER TABLE public.photo_comments
ADD CONSTRAINT photo_comments_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;