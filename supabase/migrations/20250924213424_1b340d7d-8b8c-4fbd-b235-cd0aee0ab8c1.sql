-- Fix role check to match actual enum values ('admin', 'controller')
CREATE OR REPLACE FUNCTION public.is_company_admin_or_controller(_user uuid, _company uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_company_access uca
    WHERE uca.user_id = _user
      AND uca.company_id = _company
      AND uca.role IN ('admin','controller')
  );
END;
$function$;
