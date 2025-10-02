-- Create invoice_documents table for multiple document support
CREATE TABLE IF NOT EXISTS public.invoice_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  uploaded_by UUID NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_documents ENABLE ROW LEVEL SECURITY;

-- Users can view documents for invoices they have access to
CREATE POLICY "Users can view invoice documents for their company"
ON public.invoice_documents
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM invoices i
    JOIN vendors v ON v.id = i.vendor_id
    JOIN get_user_companies(auth.uid()) uc ON uc.company_id = v.company_id
    WHERE i.id = invoice_documents.invoice_id
  )
);

-- Users can create invoice documents for their company
CREATE POLICY "Users can create invoice documents for their company"
ON public.invoice_documents
FOR INSERT
WITH CHECK (
  auth.uid() = uploaded_by AND
  EXISTS (
    SELECT 1 FROM invoices i
    JOIN vendors v ON v.id = i.vendor_id
    JOIN get_user_companies(auth.uid()) uc ON uc.company_id = v.company_id
    WHERE i.id = invoice_documents.invoice_id
  )
);

-- Users can delete invoice documents for their company
CREATE POLICY "Users can delete invoice documents for their company"
ON public.invoice_documents
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM invoices i
    JOIN vendors v ON v.id = i.vendor_id
    JOIN get_user_companies(auth.uid()) uc ON uc.company_id = v.company_id
    WHERE i.id = invoice_documents.invoice_id
  )
);

-- Create index for faster lookups
CREATE INDEX idx_invoice_documents_invoice_id ON public.invoice_documents(invoice_id);