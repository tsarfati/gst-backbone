-- Create chart of accounts for dual entry accounting
CREATE TABLE public.chart_of_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_number TEXT NOT NULL UNIQUE,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  parent_account_id UUID REFERENCES public.chart_of_accounts(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Create journal entries for dual entry accounting
CREATE TABLE public.journal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference TEXT,
  description TEXT NOT NULL,
  total_debit NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'reversed')),
  job_id UUID REFERENCES public.jobs(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  posted_at TIMESTAMP WITH TIME ZONE,
  posted_by UUID
);

-- Create journal entry line items
CREATE TABLE public.journal_entry_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  description TEXT,
  debit_amount NUMERIC(15,2) DEFAULT 0,
  credit_amount NUMERIC(15,2) DEFAULT 0,
  job_id UUID REFERENCES public.jobs(id),
  cost_code_id UUID REFERENCES public.cost_codes(id),
  line_order INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create job budgets table
CREATE TABLE public.job_budgets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  cost_code_id UUID NOT NULL REFERENCES public.cost_codes(id),
  budgeted_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  actual_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  committed_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  UNIQUE(job_id, cost_code_id)
);

-- Create payments table for banking workflow
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_number TEXT NOT NULL UNIQUE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('check', 'ach', 'wire', 'cash')),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(15,2) NOT NULL,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'sent', 'cleared', 'void')),
  check_number TEXT,
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Create payment line items to link invoices to payments
CREATE TABLE public.payment_invoice_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id),
  amount_paid NUMERIC(15,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_invoice_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chart of accounts
CREATE POLICY "Authenticated users can view chart of accounts" 
ON public.chart_of_accounts FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and controllers can manage chart of accounts" 
ON public.chart_of_accounts FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

-- RLS Policies for journal entries
CREATE POLICY "Authenticated users can view journal entries" 
ON public.journal_entries FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and controllers can manage journal entries" 
ON public.journal_entries FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

-- RLS Policies for journal entry lines
CREATE POLICY "Authenticated users can view journal entry lines" 
ON public.journal_entry_lines FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and controllers can manage journal entry lines" 
ON public.journal_entry_lines FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

-- RLS Policies for job budgets
CREATE POLICY "Authenticated users can view job budgets" 
ON public.job_budgets FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and controllers can manage job budgets" 
ON public.job_budgets FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

-- RLS Policies for payments
CREATE POLICY "Users can view payments for their company vendors" 
ON public.payments FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM vendors v 
  WHERE v.id = payments.vendor_id AND v.company_id = auth.uid()
));

CREATE POLICY "Admins and controllers can manage payments" 
ON public.payments FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

-- RLS Policies for payment invoice lines
CREATE POLICY "Users can view payment invoice lines for their company" 
ON public.payment_invoice_lines FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM payments p 
  JOIN vendors v ON v.id = p.vendor_id 
  WHERE p.id = payment_invoice_lines.payment_id AND v.company_id = auth.uid()
));

CREATE POLICY "Admins and controllers can manage payment invoice lines" 
ON public.payment_invoice_lines FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

-- Create triggers for updated_at
CREATE TRIGGER update_chart_of_accounts_updated_at
BEFORE UPDATE ON public.chart_of_accounts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_journal_entries_updated_at
BEFORE UPDATE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_job_budgets_updated_at
BEFORE UPDATE ON public.job_budgets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert basic chart of accounts
INSERT INTO public.chart_of_accounts (account_number, account_name, account_type, created_by) VALUES
('1000', 'Cash', 'asset', '00000000-0000-0000-0000-000000000000'),
('1200', 'Accounts Receivable', 'asset', '00000000-0000-0000-0000-000000000000'),
('1500', 'Inventory', 'asset', '00000000-0000-0000-0000-000000000000'),
('1600', 'Equipment', 'asset', '00000000-0000-0000-0000-000000000000'),
('2000', 'Accounts Payable', 'liability', '00000000-0000-0000-0000-000000000000'),
('2100', 'Accrued Expenses', 'liability', '00000000-0000-0000-0000-000000000000'),
('3000', 'Owner Equity', 'equity', '00000000-0000-0000-0000-000000000000'),
('4000', 'Revenue', 'revenue', '00000000-0000-0000-0000-000000000000'),
('5000', 'Cost of Goods Sold', 'expense', '00000000-0000-0000-0000-000000000000'),
('6000', 'Operating Expenses', 'expense', '00000000-0000-0000-0000-000000000000');

-- Add budget_total column to jobs table
ALTER TABLE public.jobs ADD COLUMN budget_total NUMERIC(15,2) DEFAULT 0;

-- Update invoices table to remove the direct payment option
ALTER TABLE public.invoices 
ALTER COLUMN status SET DEFAULT 'pending';

-- Add invoice_number to invoices if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'invoice_number') THEN
        ALTER TABLE public.invoices ADD COLUMN invoice_number TEXT;
    END IF;
END $$;