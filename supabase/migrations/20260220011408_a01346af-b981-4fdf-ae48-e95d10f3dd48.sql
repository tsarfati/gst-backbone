
CREATE TABLE public.pm_mobile_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id),
  mobile_logo_url TEXT,
  default_dashboard_style TEXT DEFAULT 'grid',
  primary_color TEXT DEFAULT '#E88A2D',
  dark_mode_default BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_mobile_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view pm_mobile_settings"
  ON public.pm_mobile_settings FOR SELECT
  USING (company_id IN (SELECT current_company_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage pm_mobile_settings"
  ON public.pm_mobile_settings FOR ALL
  USING (company_id IN (SELECT current_company_id FROM profiles WHERE user_id = auth.uid() AND role IN ('admin', 'controller')));

CREATE TRIGGER set_pm_mobile_settings_updated_at
  BEFORE UPDATE ON public.pm_mobile_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
