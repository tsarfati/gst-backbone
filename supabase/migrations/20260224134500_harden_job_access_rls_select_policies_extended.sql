-- Extend job-based read access hardening to additional job-linked tables.
-- Depends on helper functions from:
--   20260224133000_harden_job_access_rls_select_policies.sql
--
-- Scope (SELECT only):
--   - public.ar_invoices
--   - public.schedule_of_values
--   - public.ar_invoice_line_items
--   - public.delivery_tickets
--   - public.rfis
--   - public.rfi_attachments
--   - public.rfi_messages
--   - public.job_plans

-- ---------------------------------------------------------------------------
-- AR Invoices (company/no-job invoices remain visible; job-linked invoices require job access)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view AR invoices for their companies" ON public.ar_invoices;

CREATE POLICY "Users can view AR invoices for their companies"
ON public.ar_invoices
FOR SELECT
USING (
  (
    company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
    OR COALESCE(public.is_super_admin(auth.uid()), false)
  )
  AND (
    job_id IS NULL
    OR public.user_can_access_job(auth.uid(), job_id)
  )
);

-- ---------------------------------------------------------------------------
-- Schedule of Values (must be able to access the linked job)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view SOV for their company" ON public.schedule_of_values;

CREATE POLICY "Users can view SOV for their company"
ON public.schedule_of_values
FOR SELECT
USING (
  public.user_can_access_job(auth.uid(), schedule_of_values.job_id)
);

-- ---------------------------------------------------------------------------
-- AR Invoice Line Items (inherit access from parent AR invoice / job)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view invoice line items for their company" ON public.ar_invoice_line_items;

CREATE POLICY "Users can view invoice line items for their company"
ON public.ar_invoice_line_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.ar_invoices ai
    WHERE ai.id = ar_invoice_line_items.ar_invoice_id
      AND (
        (
          ai.company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
          OR COALESCE(public.is_super_admin(auth.uid()), false)
        )
        AND (
          ai.job_id IS NULL
          OR public.user_can_access_job(auth.uid(), ai.job_id)
        )
      )
  )
);

-- ---------------------------------------------------------------------------
-- Delivery Tickets (must be able to access linked job)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view delivery tickets for their companies" ON public.delivery_tickets;
DROP POLICY IF EXISTS "All authenticated users can view delivery tickets" ON public.delivery_tickets;

CREATE POLICY "Users can view delivery tickets for their companies"
ON public.delivery_tickets
FOR SELECT
USING (
  public.user_can_access_job(auth.uid(), delivery_tickets.job_id)
);

-- ---------------------------------------------------------------------------
-- RFIs and related tables (inherit access from RFI job)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view RFIs for their companies" ON public.rfis;

CREATE POLICY "Users can view RFIs for their companies"
ON public.rfis FOR SELECT
TO authenticated
USING (
  public.user_can_access_job(auth.uid(), rfis.job_id)
);

DROP POLICY IF EXISTS "Users can view RFI attachments for their companies" ON public.rfi_attachments;

CREATE POLICY "Users can view RFI attachments for their companies"
ON public.rfi_attachments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rfis r
    WHERE r.id = rfi_attachments.rfi_id
      AND public.user_can_access_job(auth.uid(), r.job_id)
  )
);

DROP POLICY IF EXISTS "Users can view RFI messages for their companies" ON public.rfi_messages;

CREATE POLICY "Users can view RFI messages for their companies"
ON public.rfi_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.rfis r
    WHERE r.id = rfi_messages.rfi_id
      AND public.user_can_access_job(auth.uid(), r.job_id)
  )
);

-- ---------------------------------------------------------------------------
-- Job Plans (must be able to access linked job)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view plans for their companies" ON public.job_plans;

CREATE POLICY "Users can view plans for their companies"
ON public.job_plans FOR SELECT
TO authenticated
USING (
  public.user_can_access_job(auth.uid(), job_plans.job_id)
);
