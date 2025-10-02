-- Allow global admins (profiles.role = 'admin') to manage chart of accounts regardless of company assignment role
CREATE POLICY "Global admins can manage chart of accounts"
ON public.chart_of_accounts
AS PERMISSIVE
FOR ALL
TO public
USING (public.has_role(auth.uid(), 'admin'::public.user_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.user_role));