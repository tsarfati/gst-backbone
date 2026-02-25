-- Core write-policy hardening for job-linked business records.
-- Depends on helper functions from:
--   20260224133000_harden_job_access_rls_select_policies.sql
--
-- Adds job-access checks to INSERT/UPDATE/DELETE (where applicable) so users
-- cannot write records against jobs they are not assigned to.
--
-- Scope:
--   - public.invoices
--   - public.ar_invoices
--   - public.schedule_of_values
--   - public.ar_invoice_line_items
--   - public.subcontracts
--   - public.purchase_orders
--   - public.delivery_tickets
--   - public.rfis
--   - public.rfi_attachments
--   - public.rfi_messages
--   - public.job_plans

-- ---------------------------------------------------------------------------
-- AP Invoices (vendor invoices)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create invoices for their company vendors" ON public.invoices;
DROP POLICY IF EXISTS "Users can update invoices for their company" ON public.invoices;

CREATE POLICY "Users can create invoices for their company vendors"
ON public.invoices
FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND EXISTS (
    SELECT 1
    FROM public.vendors v
    JOIN public.get_user_companies(auth.uid()) uc ON uc.company_id = v.company_id
    WHERE v.id = invoices.vendor_id
  )
  AND (
    invoices.job_id IS NULL
    OR public.user_can_access_job(auth.uid(), invoices.job_id)
  )
);

CREATE POLICY "Users can update invoices for their company"
ON public.invoices
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    JOIN public.get_user_companies(auth.uid()) uc ON uc.company_id = v.company_id
    WHERE v.id = invoices.vendor_id
  )
  AND (
    invoices.job_id IS NULL
    OR public.user_can_access_job(auth.uid(), invoices.job_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    JOIN public.get_user_companies(auth.uid()) uc ON uc.company_id = v.company_id
    WHERE v.id = invoices.vendor_id
  )
  AND (
    invoices.job_id IS NULL
    OR public.user_can_access_job(auth.uid(), invoices.job_id)
  )
);

-- ---------------------------------------------------------------------------
-- AR Invoices (draws + standard receivables)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and controllers can manage AR invoices" ON public.ar_invoices;

CREATE POLICY "Admins and controllers can manage AR invoices"
ON public.ar_invoices FOR ALL
USING (
  company_id IN (
    SELECT uc.company_id
    FROM public.get_user_companies(auth.uid()) uc
    WHERE uc.role IN ('admin', 'controller', 'project_manager')
  )
  AND (
    ar_invoices.job_id IS NULL
    OR public.user_can_access_job(auth.uid(), ar_invoices.job_id)
  )
)
WITH CHECK (
  company_id IN (
    SELECT uc.company_id
    FROM public.get_user_companies(auth.uid()) uc
    WHERE uc.role IN ('admin', 'controller', 'project_manager')
  )
  AND (
    ar_invoices.job_id IS NULL
    OR public.user_can_access_job(auth.uid(), ar_invoices.job_id)
  )
);

-- ---------------------------------------------------------------------------
-- Schedule of Values
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert SOV for their company" ON public.schedule_of_values;
DROP POLICY IF EXISTS "Users can update SOV for their company" ON public.schedule_of_values;
DROP POLICY IF EXISTS "Users can delete SOV for their company" ON public.schedule_of_values;

CREATE POLICY "Users can insert SOV for their company"
ON public.schedule_of_values
FOR INSERT
WITH CHECK (
  company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid())
  AND public.user_can_access_job(auth.uid(), schedule_of_values.job_id)
);

CREATE POLICY "Users can update SOV for their company"
ON public.schedule_of_values
FOR UPDATE
USING (
  company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid())
  AND public.user_can_access_job(auth.uid(), schedule_of_values.job_id)
)
WITH CHECK (
  company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid())
  AND public.user_can_access_job(auth.uid(), schedule_of_values.job_id)
);

CREATE POLICY "Users can delete SOV for their company"
ON public.schedule_of_values
FOR DELETE
USING (
  company_id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid())
  AND public.user_can_access_job(auth.uid(), schedule_of_values.job_id)
);

-- ---------------------------------------------------------------------------
-- AR Invoice Line Items (inherit parent AR invoice job access)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can insert invoice line items for their company" ON public.ar_invoice_line_items;
DROP POLICY IF EXISTS "Users can update invoice line items for their company" ON public.ar_invoice_line_items;
DROP POLICY IF EXISTS "Users can delete invoice line items for their company" ON public.ar_invoice_line_items;

CREATE POLICY "Users can insert invoice line items for their company"
ON public.ar_invoice_line_items
FOR INSERT
WITH CHECK (
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

CREATE POLICY "Users can update invoice line items for their company"
ON public.ar_invoice_line_items
FOR UPDATE
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
)
WITH CHECK (
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

CREATE POLICY "Users can delete invoice line items for their company"
ON public.ar_invoice_line_items
FOR DELETE
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
-- Subcontracts / Purchase Orders (admins/controllers already required; add job access)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and controllers can manage subcontracts" ON public.subcontracts;
CREATE POLICY "Admins and controllers can manage subcontracts"
ON public.subcontracts FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
  AND public.user_can_access_job(auth.uid(), subcontracts.job_id)
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
  AND public.user_can_access_job(auth.uid(), subcontracts.job_id)
);

DROP POLICY IF EXISTS "Admins and controllers can manage purchase orders" ON public.purchase_orders;
CREATE POLICY "Admins and controllers can manage purchase orders"
ON public.purchase_orders FOR ALL
USING (
  (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
  AND public.user_can_access_job(auth.uid(), purchase_orders.job_id)
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
  AND public.user_can_access_job(auth.uid(), purchase_orders.job_id)
);

-- ---------------------------------------------------------------------------
-- Delivery Tickets
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Project managers and admins can manage delivery tickets for their companies" ON public.delivery_tickets;
DROP POLICY IF EXISTS "Project managers and admins can manage delivery tickets" ON public.delivery_tickets;

CREATE POLICY "Project managers and admins can manage delivery tickets for their companies"
ON public.delivery_tickets
FOR ALL
USING (
  company_id IN (
    SELECT uc.company_id
    FROM public.get_user_companies(auth.uid()) uc(company_id, company_name, role)
    WHERE uc.role = ANY (ARRAY['admin'::user_role, 'controller'::user_role, 'project_manager'::user_role])
  )
  AND public.user_can_access_job(auth.uid(), delivery_tickets.job_id)
)
WITH CHECK (
  company_id IN (
    SELECT uc.company_id
    FROM public.get_user_companies(auth.uid()) uc(company_id, company_name, role)
    WHERE uc.role = ANY (ARRAY['admin'::user_role, 'controller'::user_role, 'project_manager'::user_role])
  )
  AND public.user_can_access_job(auth.uid(), delivery_tickets.job_id)
);

-- ---------------------------------------------------------------------------
-- RFIs + attachments/messages
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create RFIs for their companies" ON public.rfis;
DROP POLICY IF EXISTS "Users can update RFIs for their companies" ON public.rfis;
DROP POLICY IF EXISTS "Admins can delete RFIs" ON public.rfis;

CREATE POLICY "Users can create RFIs for their companies"
ON public.rfis FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND company_id IN (SELECT company_id FROM public.get_user_companies(auth.uid()))
  AND public.user_can_access_job(auth.uid(), rfis.job_id)
);

CREATE POLICY "Users can update RFIs for their companies"
ON public.rfis FOR UPDATE
TO authenticated
USING (
  company_id IN (SELECT company_id FROM public.get_user_companies(auth.uid()))
  AND public.user_can_access_job(auth.uid(), rfis.job_id)
)
WITH CHECK (
  company_id IN (SELECT company_id FROM public.get_user_companies(auth.uid()))
  AND public.user_can_access_job(auth.uid(), rfis.job_id)
);

CREATE POLICY "Admins can delete RFIs"
ON public.rfis FOR DELETE
TO authenticated
USING (
  company_id IN (
    SELECT company_id FROM public.get_user_companies(auth.uid())
    WHERE role = ANY(ARRAY['admin'::user_role, 'controller'::user_role])
  )
  AND public.user_can_access_job(auth.uid(), rfis.job_id)
);

DROP POLICY IF EXISTS "Users can create RFI attachments" ON public.rfi_attachments;
DROP POLICY IF EXISTS "Users can delete their own RFI attachments" ON public.rfi_attachments;

CREATE POLICY "Users can create RFI attachments"
ON public.rfi_attachments FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.rfis r
    WHERE r.id = rfi_attachments.rfi_id
      AND public.user_can_access_job(auth.uid(), r.job_id)
  )
);

CREATE POLICY "Users can delete their own RFI attachments"
ON public.rfi_attachments FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.rfis r
    WHERE r.id = rfi_attachments.rfi_id
      AND public.user_can_access_job(auth.uid(), r.job_id)
      AND r.company_id IN (
        SELECT company_id FROM public.get_user_companies(auth.uid())
        WHERE role = ANY(ARRAY['admin'::user_role, 'controller'::user_role])
      )
  )
);

DROP POLICY IF EXISTS "Users can create RFI messages" ON public.rfi_messages;

CREATE POLICY "Users can create RFI messages"
ON public.rfi_messages FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND company_id IN (SELECT company_id FROM public.get_user_companies(auth.uid()))
  AND EXISTS (
    SELECT 1
    FROM public.rfis r
    WHERE r.id = rfi_messages.rfi_id
      AND public.user_can_access_job(auth.uid(), r.job_id)
  )
);

-- ---------------------------------------------------------------------------
-- Job Plans
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can create plans for their companies" ON public.job_plans;
DROP POLICY IF EXISTS "Users can update plans for their companies" ON public.job_plans;
DROP POLICY IF EXISTS "Users can delete plans for their companies" ON public.job_plans;

CREATE POLICY "Users can create plans for their companies"
ON public.job_plans FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND company_id IN (SELECT company_id FROM public.get_user_companies(auth.uid()))
  AND public.user_can_access_job(auth.uid(), job_plans.job_id)
);

CREATE POLICY "Users can update plans for their companies"
ON public.job_plans FOR UPDATE
TO authenticated
USING (
  company_id IN (SELECT company_id FROM public.get_user_companies(auth.uid()))
  AND public.user_can_access_job(auth.uid(), job_plans.job_id)
)
WITH CHECK (
  company_id IN (SELECT company_id FROM public.get_user_companies(auth.uid()))
  AND public.user_can_access_job(auth.uid(), job_plans.job_id)
);

CREATE POLICY "Users can delete plans for their companies"
ON public.job_plans FOR DELETE
TO authenticated
USING (
  company_id IN (SELECT company_id FROM public.get_user_companies(auth.uid()))
  AND public.user_can_access_job(auth.uid(), job_plans.job_id)
);
