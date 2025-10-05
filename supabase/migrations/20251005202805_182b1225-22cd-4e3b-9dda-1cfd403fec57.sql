-- Add company_id to pin_employees table
ALTER TABLE public.pin_employees 
ADD COLUMN company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE;

-- Drop the existing function
DROP FUNCTION IF EXISTS public.validate_pin_for_login(text);

-- Recreate with current_company_id included
CREATE OR REPLACE FUNCTION public.validate_pin_for_login(p_pin text)
RETURNS TABLE(user_id uuid, first_name text, last_name text, role user_role, is_pin_employee boolean, current_company_id uuid)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  -- First check regular profiles
  SELECT p.user_id, p.first_name, p.last_name, p.role, false as is_pin_employee, p.current_company_id
  FROM public.profiles p
  WHERE p.pin_code = p_pin
  
  UNION ALL
  
  -- Then check PIN employees, treating them as regular employees
  SELECT pe.id as user_id, pe.first_name, pe.last_name, 'employee'::user_role as role, true as is_pin_employee, pe.company_id as current_company_id
  FROM public.pin_employees pe
  WHERE pe.pin_code = p_pin AND pe.is_active = true
  
  LIMIT 1;
$$;