-- Create user login audit table
CREATE TABLE IF NOT EXISTS public.user_login_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  login_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  login_method TEXT, -- 'email', 'google', etc.
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_login_audit ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own login history
CREATE POLICY "Users can view their own login history"
ON public.user_login_audit
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Admins and controllers can view all login history
CREATE POLICY "Admins and controllers can view all login history"
ON public.user_login_audit
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role IN ('admin', 'controller')
  )
);

-- Create index for better query performance
CREATE INDEX idx_user_login_audit_user_id ON public.user_login_audit(user_id);
CREATE INDEX idx_user_login_audit_login_time ON public.user_login_audit(login_time DESC);