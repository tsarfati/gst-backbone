-- Create invoice_cost_distributions table for multi-code bill distribution
CREATE TABLE IF NOT EXISTS public.invoice_cost_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  cost_code_id UUID NOT NULL REFERENCES public.cost_codes(id),
  amount NUMERIC NOT NULL,
  percentage NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_cost_distributions ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view invoice distributions for their companies"
ON public.invoice_cost_distributions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.invoices i
    INNER JOIN public.vendors v ON v.id = i.vendor_id
    WHERE i.id = invoice_cost_distributions.invoice_id
      AND v.company_id IN (
        SELECT company_id
        FROM get_user_companies(auth.uid())
      )
  )
);

CREATE POLICY "Users can manage invoice distributions for their companies"
ON public.invoice_cost_distributions
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.invoices i
    INNER JOIN public.vendors v ON v.id = i.vendor_id
    WHERE i.id = invoice_cost_distributions.invoice_id
      AND v.company_id IN (
        SELECT company_id
        FROM get_user_companies(auth.uid())
      )
      AND (
        SELECT role 
        FROM get_user_companies(auth.uid()) 
        WHERE company_id = v.company_id
        LIMIT 1
      ) IN ('admin', 'controller')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.invoices i
    INNER JOIN public.vendors v ON v.id = i.vendor_id
    WHERE i.id = invoice_cost_distributions.invoice_id
      AND v.company_id IN (
        SELECT company_id
        FROM get_user_companies(auth.uid())
      )
      AND (
        SELECT role 
        FROM get_user_companies(auth.uid()) 
        WHERE company_id = v.company_id
        LIMIT 1
      ) IN ('admin', 'controller')
  )
);