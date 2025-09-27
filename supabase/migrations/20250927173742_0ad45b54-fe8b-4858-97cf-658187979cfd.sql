-- Add company_id to settings tables to make them company-based
-- except for company management settings which remain user-level

-- Add company_id to notification_settings (nullable initially)
ALTER TABLE public.notification_settings 
ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- Add company_id to dashboard_settings (nullable initially)
ALTER TABLE public.dashboard_settings 
ADD COLUMN company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- Update existing notification_settings to use the user's first company
UPDATE public.notification_settings 
SET company_id = (
  SELECT uca.company_id 
  FROM public.user_company_access uca 
  WHERE uca.user_id = notification_settings.user_id 
  AND uca.is_active = true 
  ORDER BY uca.granted_at ASC 
  LIMIT 1
)
WHERE company_id IS NULL;

-- Update existing dashboard_settings to use the user's first company
UPDATE public.dashboard_settings 
SET company_id = (
  SELECT uca.company_id 
  FROM public.user_company_access uca 
  WHERE uca.user_id = dashboard_settings.user_id 
  AND uca.is_active = true 
  ORDER BY uca.granted_at ASC 
  LIMIT 1
)
WHERE company_id IS NULL;

-- Delete any settings that still don't have a company (orphaned records)
DELETE FROM public.notification_settings WHERE company_id IS NULL;
DELETE FROM public.dashboard_settings WHERE company_id IS NULL;

-- Now make company_id required
ALTER TABLE public.notification_settings 
ALTER COLUMN company_id SET NOT NULL;

ALTER TABLE public.dashboard_settings 
ALTER COLUMN company_id SET NOT NULL;

-- Update RLS policies for notification_settings to be company-based
DROP POLICY IF EXISTS "Users can view their own notification settings" ON public.notification_settings;
DROP POLICY IF EXISTS "Users can upsert their own notification settings" ON public.notification_settings;
DROP POLICY IF EXISTS "Users can update their own notification settings" ON public.notification_settings;

-- New company-based RLS policies for notification_settings
CREATE POLICY "Users can view notification settings for their companies"
ON public.notification_settings FOR SELECT
USING (
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
  )
);

CREATE POLICY "Users can create notification settings for their companies"
ON public.notification_settings FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND 
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
  )
);

CREATE POLICY "Users can update notification settings for their companies"
ON public.notification_settings FOR UPDATE
USING (
  auth.uid() = user_id AND 
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
  )
);

-- Update RLS policies for dashboard_settings to be company-based
DROP POLICY IF EXISTS "Users can view their own dashboard settings" ON public.dashboard_settings;
DROP POLICY IF EXISTS "Users can insert their own dashboard settings" ON public.dashboard_settings;
DROP POLICY IF EXISTS "Users can update their own dashboard settings" ON public.dashboard_settings;

-- New company-based RLS policies for dashboard_settings
CREATE POLICY "Users can view dashboard settings for their companies"
ON public.dashboard_settings FOR SELECT
USING (
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
  )
);

CREATE POLICY "Users can create dashboard settings for their companies"
ON public.dashboard_settings FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND 
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
  )
);

CREATE POLICY "Users can update dashboard settings for their companies"
ON public.dashboard_settings FOR UPDATE
USING (
  auth.uid() = user_id AND 
  company_id IN (
    SELECT uc.company_id 
    FROM get_user_companies(auth.uid()) uc(company_id, company_name, role)
  )
);