-- Schedule of Values (SOV) table for job billing breakdown setup
CREATE TABLE public.schedule_of_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  job_id UUID NOT NULL REFERENCES public.jobs(id),
  item_number TEXT NOT NULL,
  description TEXT NOT NULL,
  scheduled_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  cost_code_id UUID REFERENCES public.cost_codes(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- AR Invoice Line Items table for tracking billing per SOV item
CREATE TABLE public.ar_invoice_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  ar_invoice_id UUID NOT NULL REFERENCES public.ar_invoices(id) ON DELETE CASCADE,
  sov_id UUID NOT NULL REFERENCES public.schedule_of_values(id),
  scheduled_value NUMERIC(15,2) NOT NULL DEFAULT 0,
  previous_applications NUMERIC(15,2) NOT NULL DEFAULT 0,
  this_period NUMERIC(15,2) NOT NULL DEFAULT 0,
  materials_stored NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_completed NUMERIC(15,2) NOT NULL DEFAULT 0,
  percent_complete NUMERIC(5,2) NOT NULL DEFAULT 0,
  balance_to_finish NUMERIC(15,2) NOT NULL DEFAULT 0,
  retainage NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add retainage_percent column to ar_invoices for AIA billing
ALTER TABLE public.ar_invoices ADD COLUMN IF NOT EXISTS retainage_percent NUMERIC(5,2) DEFAULT 10.00;
ALTER TABLE public.ar_invoices ADD COLUMN IF NOT EXISTS application_number INTEGER DEFAULT 1;
ALTER TABLE public.ar_invoices ADD COLUMN IF NOT EXISTS period_from DATE;
ALTER TABLE public.ar_invoices ADD COLUMN IF NOT EXISTS period_to DATE;
ALTER TABLE public.ar_invoices ADD COLUMN IF NOT EXISTS contract_date DATE;
ALTER TABLE public.ar_invoices ADD COLUMN IF NOT EXISTS contract_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.ar_invoices ADD COLUMN IF NOT EXISTS change_orders_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.ar_invoices ADD COLUMN IF NOT EXISTS total_retainage NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.ar_invoices ADD COLUMN IF NOT EXISTS less_previous_certificates NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.ar_invoices ADD COLUMN IF NOT EXISTS current_payment_due NUMERIC(15,2) DEFAULT 0;

-- Enable RLS
ALTER TABLE public.schedule_of_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ar_invoice_line_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for schedule_of_values
CREATE POLICY "Users can view SOV for their company" 
ON public.schedule_of_values 
FOR SELECT 
USING (company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert SOV for their company" 
ON public.schedule_of_values 
FOR INSERT 
WITH CHECK (company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()));

CREATE POLICY "Users can update SOV for their company" 
ON public.schedule_of_values 
FOR UPDATE 
USING (company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete SOV for their company" 
ON public.schedule_of_values 
FOR DELETE 
USING (company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()));

-- RLS Policies for ar_invoice_line_items
CREATE POLICY "Users can view invoice line items for their company" 
ON public.ar_invoice_line_items 
FOR SELECT 
USING (company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert invoice line items for their company" 
ON public.ar_invoice_line_items 
FOR INSERT 
WITH CHECK (company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()));

CREATE POLICY "Users can update invoice line items for their company" 
ON public.ar_invoice_line_items 
FOR UPDATE 
USING (company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete invoice line items for their company" 
ON public.ar_invoice_line_items 
FOR DELETE 
USING (company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX idx_schedule_of_values_job_id ON public.schedule_of_values(job_id);
CREATE INDEX idx_schedule_of_values_company_id ON public.schedule_of_values(company_id);
CREATE INDEX idx_ar_invoice_line_items_invoice_id ON public.ar_invoice_line_items(ar_invoice_id);
CREATE INDEX idx_ar_invoice_line_items_sov_id ON public.ar_invoice_line_items(sov_id);

-- Trigger for updated_at
CREATE TRIGGER update_schedule_of_values_updated_at
BEFORE UPDATE ON public.schedule_of_values
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ar_invoice_line_items_updated_at
BEFORE UPDATE ON public.ar_invoice_line_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();