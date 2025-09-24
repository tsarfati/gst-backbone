-- Retry: drop and recreate non-recursive RLS for user_company_access (fix pg_policies column name)

-- 1) Ensure helper function exists
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
      AND uca.role IN ('company_admin','controller')
  );
END;
$$;

-- 2) Drop all existing policies on user_company_access
DO $$
DECLARE r record;
BEGIN
  FOR r IN (
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_company_access'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_company_access;', r.policyname);
  END LOOP;
END $$;

-- 3) Ensure RLS is enabled
ALTER TABLE public.user_company_access ENABLE ROW LEVEL SECURITY;

-- 4) Recreate safe policies
CREATE POLICY "Self can view own access"
ON public.user_company_access
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Company admins/controllers can view access"
ON public.user_company_access
FOR SELECT
USING (public.is_company_admin_or_controller(auth.uid(), company_id));

CREATE POLICY "Self can insert own access"
ON public.user_company_access
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can insert access for company"
ON public.user_company_access
FOR INSERT
WITH CHECK (public.is_company_admin_or_controller(auth.uid(), company_id));

CREATE POLICY "Self can update own access"
ON public.user_company_access
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update access for company"
ON public.user_company_access
FOR UPDATE
USING (public.is_company_admin_or_controller(auth.uid(), company_id))
WITH CHECK (public.is_company_admin_or_controller(auth.uid(), company_id));

CREATE POLICY "Self can delete own access"
ON public.user_company_access
FOR DELETE
USING (user_id = auth.uid());

CREATE POLICY "Admins can delete access for company"
ON public.user_company_access
FOR DELETE
USING (public.is_company_admin_or_controller(auth.uid(), company_id));