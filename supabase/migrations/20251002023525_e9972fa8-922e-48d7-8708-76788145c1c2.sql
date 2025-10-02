-- Create storage bucket for bank statements
INSERT INTO storage.buckets (id, name, public)
VALUES ('bank-statements', 'bank-statements', false)
ON CONFLICT (id) DO NOTHING;

-- Create bank_statements table
CREATE TABLE IF NOT EXISTS public.bank_statements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  statement_date DATE NOT NULL,
  statement_month INTEGER NOT NULL,
  statement_year INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reconcile_reports table
CREATE TABLE IF NOT EXISTS public.reconcile_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_account_id UUID NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reconcile_date DATE NOT NULL,
  reconcile_month INTEGER NOT NULL,
  reconcile_year INTEGER NOT NULL,
  statement_balance NUMERIC NOT NULL DEFAULT 0,
  book_balance NUMERIC NOT NULL DEFAULT 0,
  difference NUMERIC NOT NULL DEFAULT 0,
  is_balanced BOOLEAN NOT NULL DEFAULT false,
  file_name TEXT,
  file_url TEXT,
  file_size INTEGER,
  reconciled_by UUID NOT NULL,
  reconciled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconcile_reports ENABLE ROW LEVEL SECURITY;

-- RLS policies for bank_statements
CREATE POLICY "Users can view bank statements for their companies"
  ON public.bank_statements FOR SELECT
  USING (
    company_id IN (
      SELECT uc.company_id FROM get_user_companies(auth.uid()) uc
    )
  );

CREATE POLICY "Users can create bank statements for their companies"
  ON public.bank_statements FOR INSERT
  WITH CHECK (
    auth.uid() = uploaded_by AND
    company_id IN (
      SELECT uc.company_id FROM get_user_companies(auth.uid()) uc
      WHERE uc.role = ANY(ARRAY['admin'::user_role, 'controller'::user_role])
    )
  );

CREATE POLICY "Admins and controllers can delete bank statements"
  ON public.bank_statements FOR DELETE
  USING (
    company_id IN (
      SELECT uc.company_id FROM get_user_companies(auth.uid()) uc
      WHERE uc.role = ANY(ARRAY['admin'::user_role, 'controller'::user_role])
    )
  );

-- RLS policies for reconcile_reports
CREATE POLICY "Users can view reconcile reports for their companies"
  ON public.reconcile_reports FOR SELECT
  USING (
    company_id IN (
      SELECT uc.company_id FROM get_user_companies(auth.uid()) uc
    )
  );

CREATE POLICY "Users can create reconcile reports for their companies"
  ON public.reconcile_reports FOR INSERT
  WITH CHECK (
    auth.uid() = reconciled_by AND
    company_id IN (
      SELECT uc.company_id FROM get_user_companies(auth.uid()) uc
      WHERE uc.role = ANY(ARRAY['admin'::user_role, 'controller'::user_role])
    )
  );

CREATE POLICY "Admins and controllers can update reconcile reports"
  ON public.reconcile_reports FOR UPDATE
  USING (
    company_id IN (
      SELECT uc.company_id FROM get_user_companies(auth.uid()) uc
      WHERE uc.role = ANY(ARRAY['admin'::user_role, 'controller'::user_role])
    )
  );

CREATE POLICY "Admins and controllers can delete reconcile reports"
  ON public.reconcile_reports FOR DELETE
  USING (
    company_id IN (
      SELECT uc.company_id FROM get_user_companies(auth.uid()) uc
      WHERE uc.role = ANY(ARRAY['admin'::user_role, 'controller'::user_role])
    )
  );

-- Storage policies for bank-statements bucket
CREATE POLICY "Users can view bank statements for their companies"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'bank-statements' AND
    (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM get_user_companies(auth.uid()) uc
    )
  );

CREATE POLICY "Admins and controllers can upload bank statements"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'bank-statements' AND
    (storage.foldername(name))[1] IN (
      SELECT uc.company_id::text FROM get_user_companies(auth.uid()) uc
      WHERE uc.role = ANY(ARRAY['admin'::user_role, 'controller'::user_role])
    )
  );

CREATE POLICY "Admins and controllers can delete bank statements"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'bank-statements' AND
    (storage.foldername(name))[1] IN (
      SELECT uc.company_id::text FROM get_user_companies(auth.uid()) uc
      WHERE uc.role = ANY(ARRAY['admin'::user_role, 'controller'::user_role])
    )
  );

-- Create indexes
CREATE INDEX idx_bank_statements_account ON public.bank_statements(bank_account_id);
CREATE INDEX idx_bank_statements_company ON public.bank_statements(company_id);
CREATE INDEX idx_bank_statements_date ON public.bank_statements(statement_year, statement_month);

CREATE INDEX idx_reconcile_reports_account ON public.reconcile_reports(bank_account_id);
CREATE INDEX idx_reconcile_reports_company ON public.reconcile_reports(company_id);
CREATE INDEX idx_reconcile_reports_date ON public.reconcile_reports(reconcile_year, reconcile_month);