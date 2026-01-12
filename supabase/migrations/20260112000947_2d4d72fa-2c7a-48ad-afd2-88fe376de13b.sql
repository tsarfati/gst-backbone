-- =============================================================================
-- TENANT ISOLATION - COMPLETE SECURITY SWEEP (Fixed)
-- =============================================================================

-- 1. Create helper function to get user's tenant companies
CREATE OR REPLACE FUNCTION public.get_user_tenant_companies(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.companies c
  JOIN public.tenant_members tm ON c.tenant_id = tm.tenant_id
  WHERE tm.user_id = _user_id
  UNION
  SELECT uca.company_id
  FROM public.user_company_access uca
  WHERE uca.user_id = _user_id AND uca.is_active = true
$$;

-- 2. Create helper function to check tenant membership
CREATE OR REPLACE FUNCTION public.user_in_company_tenant(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.tenant_members tm
    JOIN public.companies c ON c.tenant_id = tm.tenant_id
    WHERE tm.user_id = _user_id 
      AND c.id = _company_id
  )
  OR EXISTS (
    SELECT 1 
    FROM public.companies c
    WHERE c.id = _company_id 
      AND c.tenant_id IS NULL
      AND c.created_by = _user_id
  )
  OR public.is_super_admin(_user_id)
$$;

-- =============================================================================
-- FIX CRITICAL PUBLIC READ ISSUES
-- =============================================================================

-- 3. FIX: jobs table
DROP POLICY IF EXISTS "Tenant members can view jobs in their tenant" ON public.jobs;
DROP POLICY IF EXISTS "Anyone can view jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can view jobs" ON public.jobs;
DROP POLICY IF EXISTS "Tenant members can view jobs in their companies" ON public.jobs;

CREATE POLICY "Tenant members can view jobs in their companies"
ON public.jobs FOR SELECT
USING (
  company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
  OR public.is_super_admin(auth.uid())
);

-- 4. FIX: pin_employees table
DROP POLICY IF EXISTS "Anyone can view pin employees" ON public.pin_employees;
DROP POLICY IF EXISTS "Users can view pin employees" ON public.pin_employees;
DROP POLICY IF EXISTS "Authenticated users can view pin employees" ON public.pin_employees;
DROP POLICY IF EXISTS "Super admins can view all pin employees" ON public.pin_employees;
DROP POLICY IF EXISTS "Tenant members can view pin employees" ON public.pin_employees;

CREATE POLICY "Tenant members can view pin employees"
ON public.pin_employees FOR SELECT
USING (
  company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
  OR public.is_super_admin(auth.uid())
);

-- 5. FIX: job_photos table
DROP POLICY IF EXISTS "Anyone can view photos" ON public.job_photos;
DROP POLICY IF EXISTS "Users can view photos" ON public.job_photos;
DROP POLICY IF EXISTS "Users can view job photos for their company" ON public.job_photos;
DROP POLICY IF EXISTS "Tenant members can view job photos" ON public.job_photos;

CREATE POLICY "Tenant members can view job photos"
ON public.job_photos FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_photos.job_id
    AND j.company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
  )
  OR public.is_super_admin(auth.uid())
);

-- 6. FIX: visitor_logs table
DROP POLICY IF EXISTS "Anyone can view visitor logs" ON public.visitor_logs;
DROP POLICY IF EXISTS "Users can view visitor logs" ON public.visitor_logs;
DROP POLICY IF EXISTS "Tenant members can view visitor logs" ON public.visitor_logs;

CREATE POLICY "Tenant members can view visitor logs"
ON public.visitor_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = visitor_logs.job_id
    AND j.company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
  )
  OR checkout_token IS NOT NULL
  OR public.is_super_admin(auth.uid())
);

-- =============================================================================
-- UPDATE COMPANIES TABLE POLICIES
-- =============================================================================

DROP POLICY IF EXISTS "Tenant members can view companies in their tenant" ON public.companies;
DROP POLICY IF EXISTS "Authenticated users can view active companies for access reques" ON public.companies;
DROP POLICY IF EXISTS "Tenant members can view their tenant companies" ON public.companies;
DROP POLICY IF EXISTS "Users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Tenant members can create companies in their tenant" ON public.companies;

CREATE POLICY "Tenant members can view their tenant companies"
ON public.companies FOR SELECT
USING (
  is_tenant_member(auth.uid(), tenant_id)
  OR (tenant_id IS NULL AND created_by = auth.uid())
  OR id IN (SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid() AND is_active = true)
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Tenant members can create companies in their tenant"
ON public.companies FOR INSERT
WITH CHECK (
  auth.uid() = created_by
  AND (
    tenant_id IS NULL
    OR is_tenant_member(auth.uid(), tenant_id)
  )
);

-- =============================================================================
-- VENDORS - Remove cross-tenant sharing
-- =============================================================================

DROP POLICY IF EXISTS "Users can view vendors for their company" ON public.vendors;
DROP POLICY IF EXISTS "Users can view shared vendors" ON public.vendors;
DROP POLICY IF EXISTS "Tenant members can view vendors in their companies" ON public.vendors;

CREATE POLICY "Tenant members can view vendors in their companies"
ON public.vendors FOR SELECT
USING (
  company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
  OR public.is_super_admin(auth.uid())
);

-- =============================================================================
-- UPDATE PHOTO ALBUMS POLICY (has job_id column)
-- =============================================================================

DROP POLICY IF EXISTS "Users can view photo albums for their company" ON public.photo_albums;
DROP POLICY IF EXISTS "Tenant members can view photo albums" ON public.photo_albums;

CREATE POLICY "Tenant members can view photo albums"
ON public.photo_albums FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = photo_albums.job_id
    AND j.company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
  )
  OR public.is_super_admin(auth.uid())
);

-- =============================================================================
-- PUNCH CLOCK LOGIN SETTINGS (has company_id)
-- =============================================================================

DROP POLICY IF EXISTS "Anyone can view punch clock settings" ON public.punch_clock_login_settings;
DROP POLICY IF EXISTS "Admins can manage punch clock settings" ON public.punch_clock_login_settings;
DROP POLICY IF EXISTS "Public can view punch clock settings" ON public.punch_clock_login_settings;
DROP POLICY IF EXISTS "Tenant members can manage punch clock settings" ON public.punch_clock_login_settings;

CREATE POLICY "Public can view punch clock settings"
ON public.punch_clock_login_settings FOR SELECT
USING (true);

CREATE POLICY "Tenant members can manage punch clock settings"
ON public.punch_clock_login_settings FOR ALL
USING (
  company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
)
WITH CHECK (
  company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
);

-- =============================================================================
-- VISITOR LOGIN SETTINGS (has company_id, NOT job_id)
-- =============================================================================

DROP POLICY IF EXISTS "Anyone can view visitor login settings" ON public.visitor_login_settings;
DROP POLICY IF EXISTS "Admins can manage visitor login settings" ON public.visitor_login_settings;
DROP POLICY IF EXISTS "Public can view visitor login settings" ON public.visitor_login_settings;
DROP POLICY IF EXISTS "Tenant members can manage visitor login settings" ON public.visitor_login_settings;

CREATE POLICY "Public can view visitor login settings"
ON public.visitor_login_settings FOR SELECT
USING (true);

CREATE POLICY "Tenant members can manage visitor login settings"
ON public.visitor_login_settings FOR ALL
USING (
  company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
)
WITH CHECK (
  company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
);

-- =============================================================================
-- VISITOR AUTO LOGOUT SETTINGS (has both job_id and company_id)
-- =============================================================================

DROP POLICY IF EXISTS "Anyone can view visitor auto logout settings" ON public.visitor_auto_logout_settings;
DROP POLICY IF EXISTS "Admins can manage visitor auto logout settings" ON public.visitor_auto_logout_settings;
DROP POLICY IF EXISTS "Tenant members can view visitor auto logout settings" ON public.visitor_auto_logout_settings;
DROP POLICY IF EXISTS "Tenant members can manage visitor auto logout settings" ON public.visitor_auto_logout_settings;

CREATE POLICY "Tenant members can view visitor auto logout settings"
ON public.visitor_auto_logout_settings FOR SELECT
USING (
  company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Tenant members can manage visitor auto logout settings"
ON public.visitor_auto_logout_settings FOR ALL
USING (
  company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
)
WITH CHECK (
  company_id IN (SELECT public.get_user_tenant_companies(auth.uid()))
);