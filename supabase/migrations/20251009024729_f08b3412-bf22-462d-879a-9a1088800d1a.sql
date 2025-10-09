-- Create table for company SMS settings
CREATE TABLE IF NOT EXISTS public.company_sms_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  provider TEXT NOT NULL DEFAULT 'twilio',
  account_sid TEXT,
  auth_token TEXT,
  phone_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.company_sms_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view SMS settings for their companies
CREATE POLICY "Users can view SMS settings for their companies"
  ON public.company_sms_settings
  FOR SELECT
  USING (
    company_id IN (
      SELECT uc.company_id
      FROM get_user_companies(auth.uid()) uc
    )
  );

-- Policy: Admins and controllers can manage SMS settings
CREATE POLICY "Admins and controllers can manage SMS settings"
  ON public.company_sms_settings
  FOR ALL
  USING (
    company_id IN (
      SELECT uc.company_id
      FROM get_user_companies(auth.uid()) uc
      WHERE uc.role IN ('admin', 'controller')
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT uc.company_id
      FROM get_user_companies(auth.uid()) uc
      WHERE uc.role IN ('admin', 'controller')
    )
  );

-- Create trigger for updated_at
CREATE TRIGGER update_company_sms_settings_updated_at
  BEFORE UPDATE ON public.company_sms_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();