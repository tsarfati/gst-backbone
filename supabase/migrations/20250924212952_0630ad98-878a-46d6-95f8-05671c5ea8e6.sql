-- Allow company admins/controllers to view all access rows for their company
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'user_company_access' 
      AND policyname = 'Company admins can view company access'
  ) THEN
    CREATE POLICY "Company admins can view company access"
    ON public.user_company_access
    FOR SELECT
    TO authenticated
    USING (public.is_company_admin_or_controller(auth.uid(), company_id));
  END IF;
END $$;

-- Secure function to validate PIN without exposing profiles table via RLS
CREATE OR REPLACE FUNCTION public.validate_pin(p_pin text)
RETURNS TABLE(user_id uuid, first_name text, last_name text, role public.user_role)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, first_name, last_name, role
  FROM public.profiles
  WHERE pin_code = p_pin
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.validate_pin(text) TO anon, authenticated;