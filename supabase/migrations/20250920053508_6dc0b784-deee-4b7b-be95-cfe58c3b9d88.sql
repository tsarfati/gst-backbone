-- Create vendors table
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  tax_id TEXT,
  payment_terms TEXT DEFAULT '30',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Create policies for vendors
CREATE POLICY "Users can view vendors for their company" 
ON public.vendors 
FOR SELECT 
USING (auth.uid() = company_id);

CREATE POLICY "Users can create vendors for their company" 
ON public.vendors 
FOR INSERT 
WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Users can update vendors for their company" 
ON public.vendors 
FOR UPDATE 
USING (auth.uid() = company_id);

CREATE POLICY "Users can delete vendors for their company" 
ON public.vendors 
FOR DELETE 
USING (auth.uid() = company_id);

-- Create updated_at trigger for vendors
CREATE TRIGGER update_vendors_updated_at
BEFORE UPDATE ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();