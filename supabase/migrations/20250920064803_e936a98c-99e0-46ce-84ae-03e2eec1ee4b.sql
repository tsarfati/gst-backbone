-- Create vendor payment methods table
CREATE TABLE public.vendor_payment_methods (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('ach', 'wire', 'check', 'credit_card')),
  bank_name TEXT,
  routing_number TEXT,
  account_number TEXT,
  account_type TEXT CHECK (account_type IN ('checking', 'savings')),
  check_delivery TEXT CHECK (check_delivery IN ('mail', 'office_pickup')),
  pickup_location TEXT,
  voided_check_url TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create vendor compliance documents table
CREATE TABLE public.vendor_compliance_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('insurance', 'w9', 'license')),
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_uploaded BOOLEAN NOT NULL DEFAULT false,
  file_name TEXT,
  file_url TEXT,
  expiration_date DATE,
  uploaded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add logo_url column to vendors table
ALTER TABLE public.vendors ADD COLUMN logo_url TEXT;

-- Enable RLS
ALTER TABLE public.vendor_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_compliance_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for vendor_payment_methods
CREATE POLICY "Users can view payment methods for their company vendors" 
ON public.vendor_payment_methods 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.vendors 
    WHERE vendors.id = vendor_payment_methods.vendor_id 
    AND vendors.company_id = auth.uid()
  )
);

CREATE POLICY "Users can create payment methods for their company vendors" 
ON public.vendor_payment_methods 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vendors 
    WHERE vendors.id = vendor_payment_methods.vendor_id 
    AND vendors.company_id = auth.uid()
  )
);

CREATE POLICY "Users can update payment methods for their company vendors" 
ON public.vendor_payment_methods 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.vendors 
    WHERE vendors.id = vendor_payment_methods.vendor_id 
    AND vendors.company_id = auth.uid()
  )
);

CREATE POLICY "Users can delete payment methods for their company vendors" 
ON public.vendor_payment_methods 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.vendors 
    WHERE vendors.id = vendor_payment_methods.vendor_id 
    AND vendors.company_id = auth.uid()
  )
);

-- Create RLS policies for vendor_compliance_documents
CREATE POLICY "Users can view compliance documents for their company vendors" 
ON public.vendor_compliance_documents 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.vendors 
    WHERE vendors.id = vendor_compliance_documents.vendor_id 
    AND vendors.company_id = auth.uid()
  )
);

CREATE POLICY "Users can create compliance documents for their company vendors" 
ON public.vendor_compliance_documents 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.vendors 
    WHERE vendors.id = vendor_compliance_documents.vendor_id 
    AND vendors.company_id = auth.uid()
  )
);

CREATE POLICY "Users can update compliance documents for their company vendors" 
ON public.vendor_compliance_documents 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.vendors 
    WHERE vendors.id = vendor_compliance_documents.vendor_id 
    AND vendors.company_id = auth.uid()
  )
);

CREATE POLICY "Users can delete compliance documents for their company vendors" 
ON public.vendor_compliance_documents 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.vendors 
    WHERE vendors.id = vendor_compliance_documents.vendor_id 
    AND vendors.company_id = auth.uid()
  )
);

-- Create triggers for updated_at columns
CREATE TRIGGER update_vendor_payment_methods_updated_at
BEFORE UPDATE ON public.vendor_payment_methods
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vendor_compliance_documents_updated_at
BEFORE UPDATE ON public.vendor_compliance_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();