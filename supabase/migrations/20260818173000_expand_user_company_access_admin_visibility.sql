CREATE OR REPLACE FUNCTION public.is_company_admin_or_controller(_user uuid, _company uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = _user
      AND uca.company_id = _company
      AND uca.role IN ('owner', 'company_admin', 'admin', 'controller')
  );
END;
$$;
