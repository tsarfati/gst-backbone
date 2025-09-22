-- Allow all authenticated users to view active companies for access requests
CREATE POLICY "Authenticated users can view active companies for access requests" 
ON companies 
FOR SELECT 
USING (is_active = true AND auth.uid() IS NOT NULL);