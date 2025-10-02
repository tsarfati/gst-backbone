-- Add company_id column to bank_accounts table
ALTER TABLE public.bank_accounts 
ADD COLUMN company_id uuid NOT NULL REFERENCES public.companies(id);

-- Update RLS policies to be company-aware
DROP POLICY IF EXISTS "Admins and controllers can manage bank accounts" ON public.bank_accounts;
DROP POLICY IF EXISTS "Authenticated users can view bank accounts" ON public.bank_accounts;

-- Admins and controllers can manage bank accounts for their companies
CREATE POLICY "Admins and controllers can manage bank accounts for their companies"
ON public.bank_accounts
FOR ALL
USING (
  company_id IN (
    SELECT uc.company_id FROM get_user_companies(auth.uid()) uc
    WHERE uc.role IN ('admin', 'controller')
  )
)
WITH CHECK (
  company_id IN (
    SELECT uc.company_id FROM get_user_companies(auth.uid()) uc
    WHERE uc.role IN ('admin', 'controller')
  )
);

-- Users can view bank accounts for their companies
CREATE POLICY "Users can view bank accounts for their companies"
ON public.bank_accounts
FOR SELECT
USING (
  company_id IN (
    SELECT uc.company_id FROM get_user_companies(auth.uid()) uc
  )
);