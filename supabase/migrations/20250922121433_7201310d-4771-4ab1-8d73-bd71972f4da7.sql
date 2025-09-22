-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Company admins can view all access for their companies" ON public.user_company_access;
DROP POLICY IF EXISTS "Company admins can manage user access" ON public.user_company_access;

-- Create simpler, non-recursive policies for user_company_access
CREATE POLICY "Users can view company access where they are members" 
ON public.user_company_access 
FOR SELECT 
USING (
  -- Users can see records for companies where they have access
  company_id IN (
    SELECT uca.company_id 
    FROM user_company_access uca 
    WHERE uca.user_id = auth.uid() 
    AND uca.is_active = true
  )
);

CREATE POLICY "Admins and controllers can insert user access" 
ON public.user_company_access 
FOR INSERT 
WITH CHECK (
  -- Check if the user making the request has admin/controller role via security definer function
  EXISTS (
    SELECT 1 FROM get_user_companies(auth.uid()) 
    WHERE company_id = user_company_access.company_id 
    AND role IN ('admin', 'controller')
  )
);

CREATE POLICY "Admins and controllers can update user access" 
ON public.user_company_access 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM get_user_companies(auth.uid()) 
    WHERE company_id = user_company_access.company_id 
    AND role IN ('admin', 'controller')
  )
);

CREATE POLICY "Admins and controllers can delete user access" 
ON public.user_company_access 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM get_user_companies(auth.uid()) 
    WHERE company_id = user_company_access.company_id 
    AND role IN ('admin', 'controller')
  )
);

-- Fix the companies policies to use the security definer function instead
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