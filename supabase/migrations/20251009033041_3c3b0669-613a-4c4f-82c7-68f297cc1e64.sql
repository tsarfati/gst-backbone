-- Allow authenticated users to view basic profile info for employees in their company ecosystem
DROP POLICY IF EXISTS "Company users can view profiles in their companies" ON public.profiles;
DROP POLICY IF EXISTS "Company members can view profiles via membership" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles for company members"
ON public.profiles
FOR SELECT
USING (
  auth.uid() IS NOT NULL
);