-- Add explicit UPDATE and DELETE policies for vendors to ensure controllers can edit vendors

-- Add UPDATE policy for vendors
CREATE POLICY "Users can update vendors for their company"
ON public.vendors
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'controller'::user_role) OR 
  EXISTS (
    SELECT 1
    FROM user_company_access
    WHERE user_company_access.user_id = auth.uid() 
    AND user_company_access.company_id = vendors.company_id 
    AND user_company_access.is_active = true
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'controller'::user_role) OR 
  EXISTS (
    SELECT 1
    FROM user_company_access
    WHERE user_company_access.user_id = auth.uid() 
    AND user_company_access.company_id = vendors.company_id 
    AND user_company_access.is_active = true
  )
);

-- Add DELETE policy for vendors
CREATE POLICY "Users can delete vendors for their company"
ON public.vendors
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'controller'::user_role) OR 
  EXISTS (
    SELECT 1
    FROM user_company_access
    WHERE user_company_access.user_id = auth.uid() 
    AND user_company_access.company_id = vendors.company_id 
    AND user_company_access.is_active = true
  )
);