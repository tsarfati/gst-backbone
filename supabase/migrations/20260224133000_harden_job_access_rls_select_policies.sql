-- Harden job-based read access to align backend RLS with Website/PM job assignments.
-- Scope (safe first pass):
--   - public.jobs (SELECT)
--   - public.invoices (SELECT)
--   - public.subcontracts (SELECT)
--   - public.purchase_orders (SELECT)
--
-- Existing public/vendor-specific job policies remain in place (separate policy names).

CREATE OR REPLACE FUNCTION public.user_has_privileged_company_job_access(_user uuid, _company uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(public.is_super_admin(_user), false)
    OR EXISTS (
      SELECT 1
      FROM public.user_company_access uca
      WHERE uca.user_id = _user
        AND uca.company_id = _company
        AND COALESCE(uca.is_active, true) = true
        AND lower(uca.role::text) IN ('admin', 'company_admin', 'controller', 'owner')
    )
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = _user
        AND lower(COALESCE(p.role::text, '')) IN ('admin', 'super_admin', 'postgres')
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_job(_user uuid, _job uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.id = _job
      AND (
        public.user_has_privileged_company_job_access(_user, j.company_id)
        OR (
          j.company_id IN (SELECT public.get_user_tenant_companies(_user))
          AND EXISTS (
            SELECT 1
            FROM public.user_job_access uja
            WHERE uja.user_id = _user
              AND uja.job_id = j.id
          )
        )
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Jobs (replace broad tenant/company read policy with job-assignment-aware read)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view jobs for their companies" ON public.jobs;
DROP POLICY IF EXISTS "Tenant members can view jobs in their companies" ON public.jobs;

CREATE POLICY "Tenant members can view jobs in their companies"
ON public.jobs
FOR SELECT
USING (
  public.user_can_access_job(auth.uid(), id)
);

-- ---------------------------------------------------------------------------
-- Invoices (company + job access; allow company-level/no-job invoices to remain visible)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view invoices for their company" ON public.invoices;

CREATE POLICY "Users can view invoices for their company"
ON public.invoices
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.vendors v
    WHERE v.id = invoices.vendor_id
      AND (
        v.company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
        OR public.is_super_admin(auth.uid())
      )
  )
  AND (
    invoices.job_id IS NULL
    OR public.user_can_access_job(auth.uid(), invoices.job_id)
  )
);

-- ---------------------------------------------------------------------------
-- Subcontracts (must be able to access subcontract's job)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view subcontracts for their company jobs" ON public.subcontracts;

CREATE POLICY "Users can view subcontracts for their company jobs"
ON public.subcontracts
FOR SELECT
USING (
  public.user_can_access_job(auth.uid(), subcontracts.job_id)
);

-- ---------------------------------------------------------------------------
-- Purchase orders (must be able to access PO's job)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view purchase orders for their company jobs" ON public.purchase_orders;

CREATE POLICY "Users can view purchase orders for their company jobs"
ON public.purchase_orders
FOR SELECT
USING (
  public.user_can_access_job(auth.uid(), purchase_orders.job_id)
);
