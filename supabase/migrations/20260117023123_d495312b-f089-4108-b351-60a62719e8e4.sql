-- Create vendor invitations table to track invites
CREATE TABLE public.vendor_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_by UUID NOT NULL,
  invited_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendor_invitations ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view invitations for their company
CREATE POLICY "Users can view vendor invitations for their company" 
ON public.vendor_invitations 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to create invitations
CREATE POLICY "Users can create vendor invitations" 
ON public.vendor_invitations 
FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
  )
);

-- Allow users to update invitations (for accepting)
CREATE POLICY "Users can update vendor invitations" 
ON public.vendor_invitations 
FOR UPDATE 
USING (
  company_id IN (
    SELECT company_id FROM public.user_company_access WHERE user_id = auth.uid()
  )
);

-- Public policy for accepting invitations via token (no auth required)
CREATE POLICY "Anyone can view invitation by token" 
ON public.vendor_invitations 
FOR SELECT 
USING (true);

-- Create index for faster lookups
CREATE INDEX idx_vendor_invitations_token ON public.vendor_invitations(token);
CREATE INDEX idx_vendor_invitations_vendor_id ON public.vendor_invitations(vendor_id);
CREATE INDEX idx_vendor_invitations_email ON public.vendor_invitations(email);