-- Drop the problematic policies that allow anonymous access
DROP POLICY IF EXISTS "Users can view job photos" ON public.job_photos;
DROP POLICY IF EXISTS "Create job photos (auth or PIN)" ON public.job_photos;

-- Keep the secure company-based policies and add proper INSERT policy
-- The "Company members can view job photos" and "Tenant members can view job photos" policies already exist and are secure

-- Create a secure INSERT policy for authenticated company members only
CREATE POLICY "Authenticated users can insert job photos"
ON public.job_photos
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.user_company_access uca ON uca.company_id = j.company_id
    WHERE j.id = job_id
    AND uca.user_id = auth.uid()
    AND uca.is_active = true
  )
);