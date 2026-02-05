-- Create table for pending user invitations
CREATE TABLE public.pending_user_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL DEFAULT 'employee',
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invite_token UUID NOT NULL UNIQUE,
  invited_by UUID NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_user_invites ENABLE ROW LEVEL SECURITY;

-- Policy: Only admins of the company can view invites
CREATE POLICY "Company admins can view pending invites"
ON public.pending_user_invites
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_company_access uca
    WHERE uca.company_id = pending_user_invites.company_id
    AND uca.user_id = auth.uid()
    AND uca.role IN ('admin', 'company_admin')
    AND uca.is_active = true
  )
);

-- Policy: Only admins can insert invites (service role bypasses for edge function)
CREATE POLICY "Company admins can create invites"
ON public.pending_user_invites
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_company_access uca
    WHERE uca.company_id = pending_user_invites.company_id
    AND uca.user_id = auth.uid()
    AND uca.role IN ('admin', 'company_admin')
    AND uca.is_active = true
  )
);

-- Create index for faster token lookup
CREATE INDEX idx_pending_invites_token ON public.pending_user_invites(invite_token);
CREATE INDEX idx_pending_invites_email ON public.pending_user_invites(email);
CREATE INDEX idx_pending_invites_company ON public.pending_user_invites(company_id);