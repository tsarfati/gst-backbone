-- Relax and correct INSERT policy for job_photos to handle PIN sessions with lingering auth
DROP POLICY IF EXISTS "Users and PIN employees can create job photos" ON public.job_photos;

CREATE POLICY "Create job photos (auth or PIN)"
ON public.job_photos
FOR INSERT
WITH CHECK (
  -- PIN mode (no Supabase session)
  (auth.uid() IS NULL AND uploaded_by IS NOT NULL)
  OR
  -- Authenticated users: must belong to the job's company
  (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.get_user_companies(auth.uid()) uc ON uc.company_id = j.company_id
    WHERE j.id = job_photos.job_id
  ))
);
