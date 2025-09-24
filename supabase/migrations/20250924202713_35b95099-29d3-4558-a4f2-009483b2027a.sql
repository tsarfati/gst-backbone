-- Drop all existing policies on user_company_access
DROP POLICY IF EXISTS "Users can view their own company access" ON user_company_access;
DROP POLICY IF EXISTS "Company admins can manage user access" ON user_company_access;
DROP POLICY IF EXISTS "Users can view their own access" ON user_company_access;

-- Create comprehensive policies for user_company_access
CREATE POLICY "Company members can view company access" 
ON user_company_access 
FOR SELECT 
USING (
  -- Users can see their own access
  (auth.uid() = user_id) OR 
  -- Admins and controllers can see all access for companies they manage
  (EXISTS (
    SELECT 1 FROM user_company_access admin_check 
    WHERE admin_check.user_id = auth.uid() 
    AND admin_check.company_id = user_company_access.company_id 
    AND admin_check.is_active = true 
    AND admin_check.role IN ('admin', 'controller')
  ))
);

CREATE POLICY "Company admins can insert user access" 
ON user_company_access 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_company_access admin_check 
    WHERE admin_check.user_id = auth.uid() 
    AND admin_check.company_id = user_company_access.company_id 
    AND admin_check.is_active = true 
    AND admin_check.role IN ('admin', 'controller')
  )
);

CREATE POLICY "Company admins can update user access" 
ON user_company_access 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM user_company_access admin_check 
    WHERE admin_check.user_id = auth.uid() 
    AND admin_check.company_id = user_company_access.company_id 
    AND admin_check.is_active = true 
    AND admin_check.role IN ('admin', 'controller')
  )
);

CREATE POLICY "Company admins can delete user access" 
ON user_company_access 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM user_company_access admin_check 
    WHERE admin_check.user_id = auth.uid() 
    AND admin_check.company_id = user_company_access.company_id 
    AND admin_check.is_active = true 
    AND admin_check.role IN ('admin', 'controller')
  )
);