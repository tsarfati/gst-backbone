
-- 1. Fix device_tokens: remove all-public policy, add user-scoped policies
DROP POLICY IF EXISTS "Service role can manage all device tokens" ON public.device_tokens;

CREATE POLICY "Users can view their own device tokens"
ON public.device_tokens
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own device tokens"
ON public.device_tokens
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own device tokens"
ON public.device_tokens
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own device tokens"
ON public.device_tokens
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service role manages device tokens"
ON public.device_tokens
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. Fix user_company_access: remove self-insert and self-update (privilege escalation)
DROP POLICY IF EXISTS "Self can insert own access" ON public.user_company_access;
DROP POLICY IF EXISTS "Self can update own access" ON public.user_company_access;

-- 3. Fix email_history: restrict insert to user's own company
DROP POLICY IF EXISTS "System can insert email history" ON public.email_history;

CREATE POLICY "Users can insert email history for their company"
ON public.email_history
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.get_user_companies(auth.uid())
  )
);

CREATE POLICY "Service role can insert email history"
ON public.email_history
FOR INSERT
TO service_role
WITH CHECK (true);
