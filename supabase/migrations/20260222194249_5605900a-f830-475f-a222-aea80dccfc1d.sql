-- Update validate_pin to block suspended users from PIN login
CREATE OR REPLACE FUNCTION public.validate_pin(p_pin text)
 RETURNS TABLE(user_id uuid, first_name text, last_name text, role user_role)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT user_id, first_name, last_name, role
  FROM public.profiles
  WHERE pin_code = p_pin
    AND (status IS NULL OR status != 'suspended')
  LIMIT 1
$function$;