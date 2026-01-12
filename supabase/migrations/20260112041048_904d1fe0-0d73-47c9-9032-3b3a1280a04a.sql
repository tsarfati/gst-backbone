-- Add INSERT policy for user_login_audit so users can log their own logins
CREATE POLICY "Users can insert their own login records"
ON public.user_login_audit
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add a logout_time column for tracking session duration
ALTER TABLE public.user_login_audit 
ADD COLUMN IF NOT EXISTS logout_time TIMESTAMP WITH TIME ZONE;