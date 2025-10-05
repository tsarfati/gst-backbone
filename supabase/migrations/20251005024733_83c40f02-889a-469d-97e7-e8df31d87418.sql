-- Create a SECURITY DEFINER function to grant company access to a user (supports PIN employees and regular users)
CREATE OR REPLACE FUNCTION public.admin_grant_company_access(
  p_user_id uuid,
  p_company_id uuid,
  p_role public.user_role DEFAULT 'employee',
  p_granted_by uuid DEFAULT NULL,
  p_is_active boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authorize: only admins or controllers of the target company can grant access
  IF NOT public.is_company_admin_or_controller(auth.uid(), p_company_id) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Upsert-style logic without requiring a unique constraint
  IF EXISTS (
    SELECT 1 FROM public.user_company_access 
    WHERE user_id = p_user_id AND company_id = p_company_id
  ) THEN
    UPDATE public.user_company_access
    SET role = p_role,
        is_active = p_is_active,
        granted_by = COALESCE(p_granted_by, auth.uid()),
        granted_at = now()
    WHERE user_id = p_user_id AND company_id = p_company_id;
  ELSE
    INSERT INTO public.user_company_access (user_id, company_id, role, granted_by, is_active)
    VALUES (p_user_id, p_company_id, p_role, COALESCE(p_granted_by, auth.uid()), p_is_active);
  END IF;
END;
$$;