-- Allow company admins to delete their companies
CREATE POLICY "Company admins can delete their companies"
ON companies
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM get_user_companies(auth.uid()) uc
    WHERE uc.company_id = companies.id 
    AND uc.role IN ('admin', 'controller')
  )
);