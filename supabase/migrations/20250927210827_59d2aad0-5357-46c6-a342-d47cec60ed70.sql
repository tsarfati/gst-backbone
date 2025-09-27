-- Create company_ui_settings table for storing company-specific UI preferences
CREATE TABLE public.company_ui_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  user_id UUID NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

-- Enable RLS
ALTER TABLE public.company_ui_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own company UI settings"
ON public.company_ui_settings
FOR SELECT
USING (
  auth.uid() = user_id AND 
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc
  )
);

CREATE POLICY "Users can create their own company UI settings"
ON public.company_ui_settings
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND 
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc
  )
);

CREATE POLICY "Users can update their own company UI settings"
ON public.company_ui_settings
FOR UPDATE
USING (
  auth.uid() = user_id AND 
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_company_ui_settings_updated_at
BEFORE UPDATE ON public.company_ui_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();