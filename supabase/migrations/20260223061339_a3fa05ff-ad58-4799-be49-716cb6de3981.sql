
-- Store Google Drive OAuth tokens per company
CREATE TABLE public.google_drive_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  folder_id TEXT,
  folder_name TEXT,
  connected_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.google_drive_tokens ENABLE ROW LEVEL SECURITY;

-- Only admins/controllers of the company can view/manage tokens
CREATE POLICY "Company admins can view drive tokens"
ON public.google_drive_tokens FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_company_access uca
    WHERE uca.company_id = google_drive_tokens.company_id
      AND uca.user_id = auth.uid()
      AND uca.role IN ('admin', 'controller')
      AND uca.is_active = true
  )
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Company admins can insert drive tokens"
ON public.google_drive_tokens FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_company_access uca
    WHERE uca.company_id = google_drive_tokens.company_id
      AND uca.user_id = auth.uid()
      AND uca.role IN ('admin', 'controller')
      AND uca.is_active = true
  )
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Company admins can update drive tokens"
ON public.google_drive_tokens FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM user_company_access uca
    WHERE uca.company_id = google_drive_tokens.company_id
      AND uca.user_id = auth.uid()
      AND uca.role IN ('admin', 'controller')
      AND uca.is_active = true
  )
  OR is_super_admin(auth.uid())
);

CREATE POLICY "Company admins can delete drive tokens"
ON public.google_drive_tokens FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM user_company_access uca
    WHERE uca.company_id = google_drive_tokens.company_id
      AND uca.user_id = auth.uid()
      AND uca.role IN ('admin', 'controller')
      AND uca.is_active = true
  )
  OR is_super_admin(auth.uid())
);

-- Trigger for updated_at
CREATE TRIGGER set_google_drive_tokens_updated_at
  BEFORE UPDATE ON public.google_drive_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
