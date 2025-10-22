-- Fix job_photos RLS policies to allow PIN employee uploads

-- Drop the existing INSERT policy that requires auth.uid()
DROP POLICY IF EXISTS "Users can create job photos" ON public.job_photos;

-- Create new INSERT policy that allows both authenticated users and PIN employees
CREATE POLICY "Users and PIN employees can create job photos"
ON public.job_photos
FOR INSERT
WITH CHECK (
  -- Allow authenticated users
  (auth.uid() IS NOT NULL AND auth.uid() = uploaded_by) OR
  -- Allow unauthenticated users (PIN employees)
  (auth.uid() IS NULL AND uploaded_by IS NOT NULL)
);

-- Update SELECT policy to also work for unauthenticated users
DROP POLICY IF EXISTS "Users can view job photos for jobs they have access to" ON public.job_photos;

CREATE POLICY "Users can view job photos"
ON public.job_photos
FOR SELECT
USING (
  -- Authenticated users can see photos for jobs they have access to
  (auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.get_user_companies(auth.uid()) uc ON uc.company_id = j.company_id
    WHERE j.id = job_photos.job_id
  )) OR
  -- Unauthenticated users (PIN employees) can see all job photos
  (auth.uid() IS NULL)
);