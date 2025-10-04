-- Create visitor auto-logout settings table
CREATE TABLE IF NOT EXISTS public.visitor_auto_logout_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  auto_logout_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_logout_hours INTEGER NOT NULL DEFAULT 8,
  geolocation_logout_enabled BOOLEAN NOT NULL DEFAULT false,
  geolocation_distance_meters INTEGER NOT NULL DEFAULT 500,
  sms_check_enabled BOOLEAN NOT NULL DEFAULT false,
  sms_check_interval_hours INTEGER NOT NULL DEFAULT 4,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(job_id, company_id)
);

-- Enable RLS
ALTER TABLE public.visitor_auto_logout_settings ENABLE ROW LEVEL SECURITY;

-- Admins and controllers can manage settings for their companies
CREATE POLICY "Users can manage visitor auto-logout settings for their companies"
ON public.visitor_auto_logout_settings
FOR ALL
USING (
  company_id IN (
    SELECT uc.company_id
    FROM get_user_companies(auth.uid()) uc
    WHERE uc.role IN ('admin', 'controller', 'project_manager')
  )
)
WITH CHECK (
  company_id IN (
    SELECT uc.company_id
    FROM get_user_companies(auth.uid()) uc
    WHERE uc.role IN ('admin', 'controller', 'project_manager')
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_visitor_auto_logout_settings_updated_at
BEFORE UPDATE ON public.visitor_auto_logout_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();