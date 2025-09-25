-- Fix RLS policies for invoices table to use correct company access
DROP POLICY IF EXISTS "Users can create invoices for their company vendors" ON public.invoices;
DROP POLICY IF EXISTS "Users can update invoices for their company" ON public.invoices;
DROP POLICY IF EXISTS "Users can view invoices for their company" ON public.invoices;

-- Create correct RLS policies that check user has access to the company
CREATE POLICY "Users can create invoices for their company vendors" 
ON public.invoices 
FOR INSERT 
WITH CHECK (
  (auth.uid() = created_by) 
  AND 
  (EXISTS (
    SELECT 1 
    FROM vendors v
    JOIN get_user_companies(auth.uid()) uc ON uc.company_id = v.company_id
    WHERE v.id = invoices.vendor_id
  ))
);

CREATE POLICY "Users can update invoices for their company" 
ON public.invoices 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 
    FROM vendors v
    JOIN get_user_companies(auth.uid()) uc ON uc.company_id = v.company_id
    WHERE v.id = invoices.vendor_id
  )
);

CREATE POLICY "Users can view invoices for their company" 
ON public.invoices 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM vendors v
    JOIN get_user_companies(auth.uid()) uc ON uc.company_id = v.company_id
    WHERE v.id = invoices.vendor_id
  )
);