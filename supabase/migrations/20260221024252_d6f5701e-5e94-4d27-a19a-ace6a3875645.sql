-- Fix get_user_tenant_companies to only return companies the user has explicit access to,
-- NOT all companies in their tenant. The previous version leaked data across companies.
CREATE OR REPLACE FUNCTION public.get_user_tenant_companies(_user_id uuid)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  -- Only return companies the user has explicit access to via user_company_access
  SELECT uca.company_id
  FROM public.user_company_access uca
  JOIN public.companies c ON c.id = uca.company_id
  WHERE uca.user_id = _user_id 
    AND uca.is_active = true
    AND c.is_active = true
  UNION
  -- Super admins can see all companies in their tenant
  SELECT c.id
  FROM public.companies c
  JOIN public.tenant_members tm ON c.tenant_id = tm.tenant_id
  WHERE tm.user_id = _user_id
    AND public.is_super_admin(_user_id)
$$;