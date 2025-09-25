-- Fix RLS policies for vendor_compliance_documents to allow controllers and proper company access

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view compliance documents for their company vendors" ON public.vendor_compliance_documents;
DROP POLICY IF EXISTS "Users can create compliance documents for their company vendors" ON public.vendor_compliance_documents;
DROP POLICY IF EXISTS "Users can update compliance documents for their company vendors" ON public.vendor_compliance_documents;
DROP POLICY IF EXISTS "Users can delete compliance documents for their company vendors" ON public.vendor_compliance_documents;

-- Create corrected policies that match the pattern used by vendors table
CREATE POLICY "Users can view compliance documents for their company vendors"
ON public.vendor_compliance_documents
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'controller'::user_role) OR 
  EXISTS (
    SELECT 1
    FROM vendors v
    JOIN user_company_access uca ON v.company_id = uca.company_id
    WHERE v.id = vendor_compliance_documents.vendor_id 
    AND uca.user_id = auth.uid() 
    AND uca.is_active = true
  )
);

CREATE POLICY "Users can create compliance documents for their company vendors"
ON public.vendor_compliance_documents
FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'controller'::user_role) OR 
  EXISTS (
    SELECT 1
    FROM vendors v
    JOIN user_company_access uca ON v.company_id = uca.company_id
    WHERE v.id = vendor_compliance_documents.vendor_id 
    AND uca.user_id = auth.uid() 
    AND uca.is_active = true
  )
);

CREATE POLICY "Users can update compliance documents for their company vendors"
ON public.vendor_compliance_documents
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'controller'::user_role) OR 
  EXISTS (
    SELECT 1
    FROM vendors v
    JOIN user_company_access uca ON v.company_id = uca.company_id
    WHERE v.id = vendor_compliance_documents.vendor_id 
    AND uca.user_id = auth.uid() 
    AND uca.is_active = true
  )
);

CREATE POLICY "Users can delete compliance documents for their company vendors"
ON public.vendor_compliance_documents
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::user_role) OR 
  has_role(auth.uid(), 'controller'::user_role) OR 
  EXISTS (
    SELECT 1
    FROM vendors v
    JOIN user_company_access uca ON v.company_id = uca.company_id
    WHERE v.id = vendor_compliance_documents.vendor_id 
    AND uca.user_id = auth.uid() 
    AND uca.is_active = true
  )
);