-- Fix vendor RLS policies to allow controllers and admins
DROP POLICY IF EXISTS "Users can create vendors for their company" ON public.vendors;
DROP POLICY IF EXISTS "Users can update vendors for their company" ON public.vendors;
DROP POLICY IF EXISTS "Users can delete vendors for their company" ON public.vendors;
DROP POLICY IF EXISTS "Users can view vendors for their company" ON public.vendors;

-- Create new policies that include role-based access
CREATE POLICY "Admins and controllers can manage all vendors"
ON public.vendors
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

CREATE POLICY "Users can view vendors for their company"
ON public.vendors
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'controller'::user_role) OR
  EXISTS (
    SELECT 1 FROM user_company_access
    WHERE user_id = auth.uid() 
    AND company_id = vendors.company_id 
    AND is_active = true
  )
);

CREATE POLICY "Users can create vendors for their company"
ON public.vendors
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'controller'::user_role) OR
  EXISTS (
    SELECT 1 FROM user_company_access
    WHERE user_id = auth.uid() 
    AND company_id = vendors.company_id 
    AND is_active = true
  )
);