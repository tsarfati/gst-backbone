-- Fix missing company access for admin user
-- Insert missing access record for the admin who created the company
INSERT INTO public.user_company_access (user_id, company_id, role, granted_by, is_active)
SELECT 
  c.created_by,
  c.id,
  'admin'::user_role,
  c.created_by,
  true
FROM public.companies c
WHERE c.created_by IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM public.user_company_access uca 
    WHERE uca.user_id = c.created_by 
    AND uca.company_id = c.id
  );

-- Also ensure the admin role is set in profiles for company creators
UPDATE public.profiles 
SET role = 'admin'::user_role
WHERE user_id IN (
  SELECT DISTINCT created_by 
  FROM public.companies 
  WHERE created_by IS NOT NULL
) AND role = 'employee'::user_role;