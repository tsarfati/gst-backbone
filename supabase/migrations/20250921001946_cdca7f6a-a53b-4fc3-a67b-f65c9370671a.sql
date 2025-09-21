-- Create invoices table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID REFERENCES public.vendors(id) NOT NULL,
  job_id UUID REFERENCES public.jobs(id) NOT NULL,
  cost_code_id UUID REFERENCES public.cost_codes(id),
  subcontract_id UUID REFERENCES public.subcontracts(id),
  amount DECIMAL(12,2) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE,
  payment_terms TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  file_url TEXT,
  is_subcontract_invoice BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Create subcontracts table
CREATE TABLE public.subcontracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.jobs(id) NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  contract_amount DECIMAL(12,2) NOT NULL,
  contract_file_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Create purchase orders table
CREATE TABLE public.purchase_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES public.jobs(id) NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id) NOT NULL,
  po_number TEXT NOT NULL,
  description TEXT,
  amount DECIMAL(12,2) NOT NULL,
  po_file_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  order_date DATE NOT NULL,
  expected_delivery DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoices
CREATE POLICY "Users can view invoices for their company" 
ON public.invoices FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.vendors v 
    WHERE v.id = invoices.vendor_id AND v.company_id = auth.uid()
  )
);

CREATE POLICY "Users can create invoices for their company vendors" 
ON public.invoices FOR INSERT 
WITH CHECK (
  auth.uid() = created_by AND
  EXISTS (
    SELECT 1 FROM public.vendors v 
    WHERE v.id = invoices.vendor_id AND v.company_id = auth.uid()
  )
);

CREATE POLICY "Users can update invoices for their company" 
ON public.invoices FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.vendors v 
    WHERE v.id = invoices.vendor_id AND v.company_id = auth.uid()
  )
);

-- RLS policies for subcontracts
CREATE POLICY "Users can view subcontracts for their company jobs" 
ON public.subcontracts FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and controllers can manage subcontracts" 
ON public.subcontracts FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

-- RLS policies for purchase orders
CREATE POLICY "Users can view purchase orders for their company jobs" 
ON public.purchase_orders FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and controllers can manage purchase orders" 
ON public.purchase_orders FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

-- Add update triggers
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subcontracts_updated_at
  BEFORE UPDATE ON public.subcontracts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at
  BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();