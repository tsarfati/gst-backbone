-- Drop the overly permissive profile viewing policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create a more secure policy that only allows users to see profiles from their own companies
CREATE POLICY "Users can view profiles from their companies"
ON public.profiles
FOR SELECT
USING (
  -- Allow users to see their own profile
  auth.uid() = user_id
  OR
  -- Allow users to see profiles of users who share at least one company with them
  EXISTS (
    SELECT 1 
    FROM get_user_companies(auth.uid()) AS my_companies
    INNER JOIN user_company_access AS other_access 
      ON my_companies.company_id = other_access.company_id
    WHERE other_access.user_id = profiles.user_id 
      AND other_access.is_active = true
  )
  OR
  -- Allow admins and controllers to see all profiles (for management purposes)
  has_role(auth.uid(), 'admin'::user_role) 
  OR 
  has_role(auth.uid(), 'controller'::user_role)
);