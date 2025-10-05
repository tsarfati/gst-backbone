-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Users can view profiles from their companies" ON public.profiles;

-- Create a new, properly scoped policy that restricts admins/controllers
-- to only see profiles of users in their companies
CREATE POLICY "Users can view profiles from their companies" 
ON public.profiles 
FOR SELECT 
USING (
  -- Users can always see their own profile
  auth.uid() = user_id 
  OR 
  -- Users can see profiles of people who share at least one company with them
  EXISTS (
    SELECT 1
    FROM get_user_companies(auth.uid()) my_companies
    JOIN user_company_access other_access 
      ON my_companies.company_id = other_access.company_id
    WHERE other_access.user_id = profiles.user_id 
      AND other_access.is_active = true
  )
);