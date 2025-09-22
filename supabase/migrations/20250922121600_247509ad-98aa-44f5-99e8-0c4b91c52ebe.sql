-- Drop ALL existing policies for user_company_access to start fresh
DROP POLICY IF EXISTS "Users can view their own company access" ON public.user_company_access;
DROP POLICY IF EXISTS "Company admins can view all access for their companies" ON public.user_company_access;
DROP POLICY IF EXISTS "Company admins can manage user access" ON public.user_company_access;
DROP POLICY IF EXISTS "Users can view company access where they are members" ON public.user_company_access;
DROP POLICY IF EXISTS "Admins and controllers can insert user access" ON public.user_company_access;
DROP POLICY IF EXISTS "Admins and controllers can update user access" ON public.user_company_access;
DROP POLICY IF EXISTS "Admins and controllers can delete user access" ON public.user_company_access;

-- Create simple, non-recursive policies for user_company_access
CREATE POLICY "Users can view their own company access" 
ON public.user_company_access 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Company owners can manage user access" 
ON public.user_company_access 
FOR ALL 
USING (
  -- Only allow operations on companies where the user is already an admin
  -- Use the security definer function to avoid recursion
  EXISTS (
    SELECT 1 FROM get_user_companies(auth.uid()) 
    WHERE company_id = user_company_access.company_id 
    AND role IN ('admin', 'controller')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM get_user_companies(auth.uid()) 
    WHERE company_id = user_company_access.company_id 
    AND role IN ('admin', 'controller')
  )
);

-- Fix the companies policies
DROP POLICY IF EXISTS "Users can view companies they have access to" ON public.companies;
CREATE POLICY "Users can view companies they have access to" 
ON public.companies 
FOR SELECT 
USING (
  id IN (
    SELECT company_id FROM get_user_companies(auth.uid())
  )
);

DROP POLICY IF EXISTS "Company admins can update their companies" ON public.companies;
CREATE POLICY "Company admins can update their companies" 
ON public.companies 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM get_user_companies(auth.uid()) 
    WHERE company_id = companies.id 
    AND role IN ('admin', 'controller')
  )
);