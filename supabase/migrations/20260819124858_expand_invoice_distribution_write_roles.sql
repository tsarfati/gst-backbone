-- Allow owner/company_admin/admin/controller to manage invoice cost distributions.
-- This aligns distribution writes with the broader AP invoice access model used elsewhere.

DROP POLICY IF EXISTS "Users can manage invoice distributions for their companies"
ON public.invoice_cost_distributions;

CREATE POLICY "Users can manage invoice distributions for their companies"
ON public.invoice_cost_distributions
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.invoices i
    INNER JOIN public.vendors v ON v.id = i.vendor_id
    INNER JOIN public.get_user_companies(auth.uid()) actor
      ON actor.company_id = v.company_id
    WHERE i.id = invoice_cost_distributions.invoice_id
      AND lower(COALESCE(actor.role::text, '')) IN ('owner', 'admin', 'company_admin', 'controller')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.invoices i
    INNER JOIN public.vendors v ON v.id = i.vendor_id
    INNER JOIN public.get_user_companies(auth.uid()) actor
      ON actor.company_id = v.company_id
    WHERE i.id = invoice_cost_distributions.invoice_id
      AND lower(COALESCE(actor.role::text, '')) IN ('owner', 'admin', 'company_admin', 'controller')
  )
);
