-- Drop the old restrictive delete policy
DROP POLICY IF EXISTS "Users can delete their own job photos" ON public.job_photos;

-- Create a new delete policy that allows:
-- 1. Users to delete their own photos
-- 2. Admins/controllers of the company to delete any photo in their company's jobs
CREATE POLICY "Users and admins can delete job photos"
ON public.job_photos
FOR DELETE
USING (
  auth.uid() = uploaded_by
  OR EXISTS (
    SELECT 1
    FROM jobs j
    JOIN user_company_access uca ON uca.company_id = j.company_id
    WHERE j.id = job_photos.job_id
      AND uca.user_id = auth.uid()
      AND uca.is_active = true
      AND uca.role IN ('admin', 'controller')
  )
  OR is_super_admin(auth.uid())
);