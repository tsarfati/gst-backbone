-- Create receipts table for company-wide receipt management
CREATE TABLE public.receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  created_by uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer,
  amount numeric,
  vendor_name text,
  receipt_date date,
  job_id uuid,
  cost_code_id uuid,
  notes text,
  status text NOT NULL DEFAULT 'uncoded',
  assigned_to uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

-- Create policies for company-wide access
CREATE POLICY "Users can view receipts for their company" 
ON public.receipts 
FOR SELECT 
USING (company_id IN (
  SELECT get_user_companies.company_id
  FROM get_user_companies(auth.uid()) get_user_companies(company_id, company_name, role)
));

CREATE POLICY "Users can create receipts for their company" 
ON public.receipts 
FOR INSERT 
WITH CHECK (
  auth.uid() = created_by AND 
  company_id IN (
    SELECT get_user_companies.company_id
    FROM get_user_companies(auth.uid()) get_user_companies(company_id, company_name, role)
  )
);

CREATE POLICY "Users can update receipts for their company" 
ON public.receipts 
FOR UPDATE 
USING (company_id IN (
  SELECT get_user_companies.company_id
  FROM get_user_companies(auth.uid()) get_user_companies(company_id, company_name, role)
));

CREATE POLICY "Admins and controllers can delete receipts" 
ON public.receipts 
FOR DELETE 
USING (
  company_id IN (
    SELECT get_user_companies.company_id
    FROM get_user_companies(auth.uid()) get_user_companies(company_id, company_name, role)
    WHERE role IN ('admin', 'controller')
  )
);

-- Create receipt messages table for communication
CREATE TABLE public.receipt_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  from_user_id uuid NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on messages
ALTER TABLE public.receipt_messages ENABLE ROW LEVEL SECURITY;

-- Messages visible to users who can see the receipt
CREATE POLICY "Users can view messages for accessible receipts" 
ON public.receipt_messages 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.receipts r 
  WHERE r.id = receipt_id AND r.company_id IN (
    SELECT get_user_companies.company_id
    FROM get_user_companies(auth.uid()) get_user_companies(company_id, company_name, role)
  )
));

CREATE POLICY "Users can create messages for accessible receipts" 
ON public.receipt_messages 
FOR INSERT 
WITH CHECK (
  auth.uid() = from_user_id AND 
  EXISTS (
    SELECT 1 FROM public.receipts r 
    WHERE r.id = receipt_id AND r.company_id IN (
      SELECT get_user_companies.company_id
      FROM get_user_companies(auth.uid()) get_user_companies(company_id, company_name, role)
    )
  )
);

-- Add indexes for performance
CREATE INDEX idx_receipts_company_id ON public.receipts(company_id);
CREATE INDEX idx_receipts_status ON public.receipts(status);
CREATE INDEX idx_receipts_created_by ON public.receipts(created_by);
CREATE INDEX idx_receipts_assigned_to ON public.receipts(assigned_to);
CREATE INDEX idx_receipt_messages_receipt_id ON public.receipt_messages(receipt_id);

-- Add updated_at trigger
CREATE TRIGGER update_receipts_updated_at
  BEFORE UPDATE ON public.receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();