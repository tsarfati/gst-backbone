
-- Update job_photos to set pin_employee_id based on the ID embedded in the photo_url
-- The URL pattern is: punch-photos/{pin_employee_id}/job-{job_id}/...
UPDATE public.job_photos jp
SET pin_employee_id = pe.id
FROM public.pin_employees pe
WHERE jp.photo_url LIKE '%punch-photos/' || pe.id::text || '/%'
  AND jp.pin_employee_id IS NULL;
