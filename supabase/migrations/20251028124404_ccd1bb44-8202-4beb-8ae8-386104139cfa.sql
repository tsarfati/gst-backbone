-- Fix RLS policies for vendor_payment_methods to correctly authorize by company access

-- Ensure RLS is enabled
ALTER TABLE public.vendor_payment_methods ENABLE ROW LEVEL SECURITY;

-- Drop incorrect existing policies
DROP POLICY IF EXISTS "Users can create payment methods for their company vendors" ON public.vendor_payment_methods;
DROP POLICY IF EXISTS "Users can delete payment methods for their company vendors" ON public.vendor_payment_methods;
DROP POLICY IF EXISTS "Users can update payment methods for their company vendors" ON public.vendor_payment_methods;
DROP POLICY IF EXISTS "Users can view payment methods for their company vendors" ON public.vendor_payment_methods;

-- View policy
CREATE POLICY "Users can view vendor payment methods"
ON public.vendor_payment_methods
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = vendor_payment_methods.vendor_id
      AND public.has_company_access(auth.uid(), v.company_id)
  )
);

-- Insert policy
CREATE POLICY "Users can insert vendor payment methods"
ON public.vendor_payment_methods
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = vendor_payment_methods.vendor_id
      AND public.has_company_access(auth.uid(), v.company_id)
  )
);

-- Update policy
CREATE POLICY "Users can update vendor payment methods"
ON public.vendor_payment_methods
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = vendor_payment_methods.vendor_id
      AND public.has_company_access(auth.uid(), v.company_id)
  )
);

-- Delete policy
CREATE POLICY "Users can delete vendor payment methods"
ON public.vendor_payment_methods
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = vendor_payment_methods.vendor_id
      AND public.has_company_access(auth.uid(), v.company_id)
  )
);
