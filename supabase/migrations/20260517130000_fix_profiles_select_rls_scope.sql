-- Tighten profiles SELECT access so authenticated users only see:
-- 1. their own profile
-- 2. profiles of users who share an active company membership
-- 3. any profile if they are a super admin

DROP POLICY IF EXISTS "Authenticated users can view profiles for company members" ON public.profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles from their companies" ON public.profiles;
DROP POLICY IF EXISTS "Company members can view profiles via membership" ON public.profiles;

CREATE POLICY "Users can view profiles from shared companies"
ON public.profiles
FOR SELECT
USING (
  auth.uid() = user_id
  OR COALESCE(public.is_super_admin(auth.uid()), false)
  OR EXISTS (
    SELECT 1
    FROM public.user_company_access actor
    JOIN public.user_company_access target
      ON target.company_id = actor.company_id
     AND target.user_id = profiles.user_id
     AND target.is_active = true
    WHERE actor.user_id = auth.uid()
      AND actor.is_active = true
  )
);
