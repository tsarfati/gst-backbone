-- Create user_invitations table to track invitation status
CREATE TABLE public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role TEXT NOT NULL DEFAULT 'employee',
  invited_by UUID NOT NULL,
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  status TEXT NOT NULL DEFAULT 'pending',
  email_status TEXT DEFAULT 'sent',
  email_delivered_at TIMESTAMP WITH TIME ZONE,
  email_opened_at TIMESTAMP WITH TIME ZONE,
  email_bounced_at TIMESTAMP WITH TIME ZONE,
  resend_message_id TEXT,
  accepted_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Create policies for user_invitations
CREATE POLICY "Users can view invitations for their company"
ON public.user_invitations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_company_access
    WHERE user_company_access.company_id = user_invitations.company_id
    AND user_company_access.user_id = auth.uid()
    AND user_company_access.is_active = true
  )
);

CREATE POLICY "Admins can insert invitations"
ON public.user_invitations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_company_access
    WHERE user_company_access.company_id = user_invitations.company_id
    AND user_company_access.user_id = auth.uid()
    AND user_company_access.is_active = true
    AND user_company_access.role IN ('admin', 'company_admin')
  )
);

CREATE POLICY "Admins can update invitations"
ON public.user_invitations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_company_access
    WHERE user_company_access.company_id = user_invitations.company_id
    AND user_company_access.user_id = auth.uid()
    AND user_company_access.is_active = true
    AND user_company_access.role IN ('admin', 'company_admin')
  )
);

-- Create index for faster lookups
CREATE INDEX idx_user_invitations_company_id ON public.user_invitations(company_id);
CREATE INDEX idx_user_invitations_email ON public.user_invitations(email);
CREATE INDEX idx_user_invitations_status ON public.user_invitations(status);

-- Create trigger for updated_at
CREATE TRIGGER update_user_invitations_updated_at
BEFORE UPDATE ON public.user_invitations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();