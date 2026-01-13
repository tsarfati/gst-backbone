-- Automatically grant the creating user admin access to the company they create
-- This avoids relying on profiles.role and ensures consistent company access.

CREATE OR REPLACE FUNCTION public.grant_company_creator_admin_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- created_by is required on companies
  INSERT INTO public.user_company_access (
    user_id,
    company_id,
    role,
    is_active,
    granted_by,
    granted_at
  )
  VALUES (
    NEW.created_by,
    NEW.id,
    'admin',
    TRUE,
    NEW.created_by,
    NOW()
  )
  ON CONFLICT (user_id, company_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    is_active = TRUE,
    granted_by = EXCLUDED.granted_by,
    granted_at = EXCLUDED.granted_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_company_creator_admin_access ON public.companies;

CREATE TRIGGER trg_grant_company_creator_admin_access
AFTER INSERT ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.grant_company_creator_admin_access();
