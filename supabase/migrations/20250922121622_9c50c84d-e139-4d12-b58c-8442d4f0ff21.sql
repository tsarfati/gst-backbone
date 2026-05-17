-- Drop the problematic recursive policy
DROP POLICY IF EXISTS "Company owners can manage user access" ON public.user_company_access;

-- Create new non-recursive policies with different names
DROP POLICY IF EXISTS "Admins can manage company users" ON public.user_company_access;
CREATE POLICY "Admins can manage company users" 
ON public.user_company_access 
FOR INSERT 
WITH CHECK (
  -- Allow users to add others to companies where they are admin
  -- This avoids recursion by using the security definer function
  company_id IN (
    SELECT company_id FROM get_user_companies(auth.uid()) 
    WHERE role IN ('admin', 'controller')
  )
);

DROP POLICY IF EXISTS "Admins can update company users" ON public.user_company_access;
CREATE POLICY "Admins can update company users" 
ON public.user_company_access 
FOR UPDATE 
USING (
  company_id IN (
    SELECT company_id FROM get_user_companies(auth.uid()) 
    WHERE role IN ('admin', 'controller')
  )
);

DROP POLICY IF EXISTS "Admins can remove company users" ON public.user_company_access;
CREATE POLICY "Admins can remove company users" 
ON public.user_company_access 
FOR DELETE 
USING (
  company_id IN (
    SELECT company_id FROM get_user_companies(auth.uid()) 
    WHERE role IN ('admin', 'controller')
  )
);
