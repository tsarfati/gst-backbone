-- Create customers table for Accounts Receivable
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  payment_terms TEXT DEFAULT '30',
  credit_limit NUMERIC DEFAULT 0,
  current_balance NUMERIC DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Create AR invoices table (separate from vendor invoices)
CREATE TABLE public.ar_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  balance_due NUMERIC GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
  status TEXT NOT NULL DEFAULT 'draft',
  description TEXT,
  notes TEXT,
  terms TEXT,
  file_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Create AR payments/receipts table
CREATE TABLE public.ar_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  ar_invoice_id UUID REFERENCES public.ar_invoices(id) ON DELETE SET NULL,
  payment_number TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'check',
  reference_number TEXT,
  check_number TEXT,
  bank_account_id UUID REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  deposit_date DATE,
  memo TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_payments ENABLE ROW LEVEL SECURITY;

-- Customers RLS policies
CREATE POLICY "Users can view customers for their companies"
ON public.customers FOR SELECT
USING (company_id IN (SELECT uc.company_id FROM get_user_companies(auth.uid()) uc));

CREATE POLICY "Admins and controllers can manage customers"
ON public.customers FOR ALL
USING (company_id IN (SELECT uc.company_id FROM get_user_companies(auth.uid()) uc WHERE uc.role IN ('admin', 'controller', 'project_manager')))
WITH CHECK (company_id IN (SELECT uc.company_id FROM get_user_companies(auth.uid()) uc WHERE uc.role IN ('admin', 'controller', 'project_manager')));

-- AR Invoices RLS policies
CREATE POLICY "Users can view AR invoices for their companies"
ON public.ar_invoices FOR SELECT
USING (company_id IN (SELECT uc.company_id FROM get_user_companies(auth.uid()) uc));

CREATE POLICY "Admins and controllers can manage AR invoices"
ON public.ar_invoices FOR ALL
USING (company_id IN (SELECT uc.company_id FROM get_user_companies(auth.uid()) uc WHERE uc.role IN ('admin', 'controller', 'project_manager')))
WITH CHECK (company_id IN (SELECT uc.company_id FROM get_user_companies(auth.uid()) uc WHERE uc.role IN ('admin', 'controller', 'project_manager')));

-- AR Payments RLS policies
CREATE POLICY "Users can view AR payments for their companies"
ON public.ar_payments FOR SELECT
USING (company_id IN (SELECT uc.company_id FROM get_user_companies(auth.uid()) uc));

CREATE POLICY "Admins and controllers can manage AR payments"
ON public.ar_payments FOR ALL
USING (company_id IN (SELECT uc.company_id FROM get_user_companies(auth.uid()) uc WHERE uc.role IN ('admin', 'controller')))
WITH CHECK (company_id IN (SELECT uc.company_id FROM get_user_companies(auth.uid()) uc WHERE uc.role IN ('admin', 'controller')));

-- Create updated_at triggers
CREATE TRIGGER set_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_ar_invoices_updated_at
BEFORE UPDATE ON public.ar_invoices
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_ar_payments_updated_at
BEFORE UPDATE ON public.ar_payments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Create indexes for performance
CREATE INDEX idx_customers_company_id ON public.customers(company_id);
CREATE INDEX idx_ar_invoices_company_id ON public.ar_invoices(company_id);
CREATE INDEX idx_ar_invoices_customer_id ON public.ar_invoices(customer_id);
CREATE INDEX idx_ar_payments_company_id ON public.ar_payments(company_id);
CREATE INDEX idx_ar_payments_customer_id ON public.ar_payments(customer_id);
CREATE INDEX idx_ar_payments_ar_invoice_id ON public.ar_payments(ar_invoice_id);