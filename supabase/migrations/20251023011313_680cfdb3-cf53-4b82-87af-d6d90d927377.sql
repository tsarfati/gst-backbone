-- Add fields to credit_card_transactions for job costing and coding requests
ALTER TABLE credit_card_transactions
ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES jobs(id),
ADD COLUMN IF NOT EXISTS cost_code_id uuid REFERENCES cost_codes(id),
ADD COLUMN IF NOT EXISTS attachment_url text,
ADD COLUMN IF NOT EXISTS requested_coder_id uuid REFERENCES profiles(user_id),
ADD COLUMN IF NOT EXISTS coding_status text DEFAULT 'uncoded' CHECK (coding_status IN ('uncoded', 'pending', 'coded'));

-- Create credit card statements table
CREATE TABLE IF NOT EXISTS credit_card_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_card_id uuid NOT NULL REFERENCES credit_cards(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  statement_date date NOT NULL,
  statement_month integer NOT NULL,
  statement_year integer NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size integer,
  display_name text,
  notes text,
  uploaded_by uuid NOT NULL,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_credit_card_statements_card_id ON credit_card_statements(credit_card_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_statements_company_id ON credit_card_statements(company_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_transactions_job_id ON credit_card_transactions(job_id);
CREATE INDEX IF NOT EXISTS idx_credit_card_transactions_requested_coder ON credit_card_transactions(requested_coder_id);

-- Enable RLS on credit_card_statements
ALTER TABLE credit_card_statements ENABLE ROW LEVEL SECURITY;

-- RLS policies for credit_card_statements
CREATE POLICY "Users can view statements for their companies"
  ON credit_card_statements FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM get_user_companies(auth.uid())
  ));

CREATE POLICY "Admins and controllers can create statements"
  ON credit_card_statements FOR INSERT
  WITH CHECK (
    uploaded_by = auth.uid() AND
    company_id IN (
      SELECT uc.company_id FROM get_user_companies(auth.uid()) uc
      WHERE uc.role IN ('admin', 'controller')
    )
  );

CREATE POLICY "Admins and controllers can delete statements"
  ON credit_card_statements FOR DELETE
  USING (company_id IN (
    SELECT uc.company_id FROM get_user_companies(auth.uid()) uc
    WHERE uc.role IN ('admin', 'controller')
  ));

-- Create storage bucket for credit card attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('credit-card-attachments', 'credit-card-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for credit card statements
INSERT INTO storage.buckets (id, name, public)
VALUES ('credit-card-statements', 'credit-card-statements', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for credit card attachments
CREATE POLICY "Users can view attachments for their companies"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'credit-card-attachments' AND
    (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM get_user_companies(auth.uid())
    )
  );

CREATE POLICY "Users can upload attachments for their companies"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'credit-card-attachments' AND
    (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM get_user_companies(auth.uid())
    )
  );

CREATE POLICY "Users can delete attachments for their companies"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'credit-card-attachments' AND
    (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM get_user_companies(auth.uid())
    )
  );

-- RLS policies for credit card statements storage
CREATE POLICY "Users can view statements for their companies"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'credit-card-statements' AND
    (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM get_user_companies(auth.uid())
    )
  );

CREATE POLICY "Users can upload statements for their companies"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'credit-card-statements' AND
    (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM get_user_companies(auth.uid())
    )
  );

CREATE POLICY "Users can delete statements for their companies"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'credit-card-statements' AND
    (storage.foldername(name))[1] IN (
      SELECT company_id::text FROM get_user_companies(auth.uid())
    )
  );

-- Create table for coding request notifications
CREATE TABLE IF NOT EXISTS credit_card_coding_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES credit_card_transactions(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  requested_coder_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  message text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  UNIQUE(transaction_id, requested_coder_id)
);

-- Enable RLS
ALTER TABLE credit_card_coding_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for coding requests
CREATE POLICY "Users can view coding requests for their companies"
  ON credit_card_coding_requests FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM get_user_companies(auth.uid()))
    OR requested_coder_id = auth.uid()
  );

CREATE POLICY "Users can create coding requests"
  ON credit_card_coding_requests FOR INSERT
  WITH CHECK (
    requested_by = auth.uid() AND
    company_id IN (SELECT company_id FROM get_user_companies(auth.uid()))
  );

CREATE POLICY "Users can update their assigned coding requests"
  ON credit_card_coding_requests FOR UPDATE
  USING (requested_coder_id = auth.uid() OR requested_by = auth.uid());

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_coding_requests_coder ON credit_card_coding_requests(requested_coder_id, status);
CREATE INDEX IF NOT EXISTS idx_coding_requests_company ON credit_card_coding_requests(company_id);