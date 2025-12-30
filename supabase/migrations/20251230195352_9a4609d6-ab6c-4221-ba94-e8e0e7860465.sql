
-- Add vendor_id to profiles table to link vendor users to their vendor record
ALTER TABLE public.profiles ADD COLUMN vendor_id uuid REFERENCES public.vendors(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_profiles_vendor_id ON public.profiles(vendor_id);

-- Create a security definer function to get the vendor_id for the current user
CREATE OR REPLACE FUNCTION public.get_user_vendor_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT vendor_id FROM public.profiles WHERE user_id = _user_id
$$;

-- Create a function to check if user is a vendor
CREATE OR REPLACE FUNCTION public.is_vendor_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = _user_id 
    AND role = 'vendor'::user_role
    AND vendor_id IS NOT NULL
  )
$$;

-- Update invoices (bills) RLS to allow vendors to see only their own bills
DROP POLICY IF EXISTS "Vendors can view their own invoices" ON public.invoices;
CREATE POLICY "Vendors can view their own invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (
  is_vendor_user(auth.uid()) AND vendor_id = get_user_vendor_id(auth.uid())
);

-- Update subcontracts RLS to allow vendors to see only their own subcontracts
DROP POLICY IF EXISTS "Vendors can view their own subcontracts" ON public.subcontracts;
CREATE POLICY "Vendors can view their own subcontracts"
ON public.subcontracts
FOR SELECT
TO authenticated
USING (
  is_vendor_user(auth.uid()) AND vendor_id = get_user_vendor_id(auth.uid())
);

-- Update payments RLS to allow vendors to see only their own payments
DROP POLICY IF EXISTS "Vendors can view their own payments" ON public.payments;
CREATE POLICY "Vendors can view their own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
  is_vendor_user(auth.uid()) AND vendor_id = get_user_vendor_id(auth.uid())
);

-- Allow vendors to view jobs they have bills or subcontracts on
DROP POLICY IF EXISTS "Vendors can view jobs they are associated with" ON public.jobs;
CREATE POLICY "Vendors can view jobs they are associated with"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  is_vendor_user(auth.uid()) 
  AND (
    EXISTS (
      SELECT 1 FROM public.invoices 
      WHERE invoices.job_id = jobs.id 
      AND invoices.vendor_id = get_user_vendor_id(auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.subcontracts 
      WHERE subcontracts.job_id = jobs.id 
      AND subcontracts.vendor_id = get_user_vendor_id(auth.uid())
    )
  )
);

-- Allow vendors to view their own vendor record
DROP POLICY IF EXISTS "Vendors can view their own vendor record" ON public.vendors;
CREATE POLICY "Vendors can view their own vendor record"
ON public.vendors
FOR SELECT
TO authenticated
USING (
  is_vendor_user(auth.uid()) AND id = get_user_vendor_id(auth.uid())
);

-- Allow vendors to view payment_invoice_lines for their own bills
DROP POLICY IF EXISTS "Vendors can view payment_invoice_lines for their bills" ON public.payment_invoice_lines;
CREATE POLICY "Vendors can view payment_invoice_lines for their bills"
ON public.payment_invoice_lines
FOR SELECT
TO authenticated
USING (
  is_vendor_user(auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = payment_invoice_lines.invoice_id 
    AND invoices.vendor_id = get_user_vendor_id(auth.uid())
  )
);

-- Allow vendors to view invoice documents for their own bills
DROP POLICY IF EXISTS "Vendors can view their invoice documents" ON public.invoice_documents;
CREATE POLICY "Vendors can view their invoice documents"
ON public.invoice_documents
FOR SELECT
TO authenticated
USING (
  is_vendor_user(auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_documents.invoice_id 
    AND invoices.vendor_id = get_user_vendor_id(auth.uid())
  )
);

-- Allow vendors to view invoice cost distributions for their own bills
DROP POLICY IF EXISTS "Vendors can view their invoice cost distributions" ON public.invoice_cost_distributions;
CREATE POLICY "Vendors can view their invoice cost distributions"
ON public.invoice_cost_distributions
FOR SELECT
TO authenticated
USING (
  is_vendor_user(auth.uid()) 
  AND EXISTS (
    SELECT 1 FROM public.invoices 
    WHERE invoices.id = invoice_cost_distributions.invoice_id 
    AND invoices.vendor_id = get_user_vendor_id(auth.uid())
  )
);
