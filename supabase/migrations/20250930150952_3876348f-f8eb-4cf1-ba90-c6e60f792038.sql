-- Drop conflicting policies if they exist
DROP POLICY IF EXISTS "Admins and controllers can manage pin employee timecard setting" ON public.pin_employee_timecard_settings;
DROP POLICY IF EXISTS "Project managers can manage pin employee timecard setting" ON public.pin_employee_timecard_settings;
DROP POLICY IF EXISTS "Users can view pin employee timecard settings for their com" ON public.pin_employee_timecard_settings;

-- Create settings table for PIN employees to avoid FK to auth.users
CREATE TABLE IF NOT EXISTS public.pin_employee_timecard_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pin_employee_id UUID NOT NULL REFERENCES public.pin_employees(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  assigned_jobs UUID[] NOT NULL DEFAULT '{}'::uuid[],
  assigned_cost_codes UUID[] NOT NULL DEFAULT '{}'::uuid[],
  require_location BOOLEAN NOT NULL DEFAULT true,
  require_photo BOOLEAN NOT NULL DEFAULT true,
  notification_preferences JSONB NOT NULL DEFAULT '{"overtime_alerts": true, "punch_reminders": true, "missed_punch_alerts": true}',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_pin_emp_company UNIQUE (pin_employee_id, company_id)
);

-- Enable Row Level Security
ALTER TABLE public.pin_employee_timecard_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "pin_emp_tc_admin_manage"
ON public.pin_employee_timecard_settings FOR ALL
USING (
  company_id IN (
    SELECT uc.company_id FROM public.get_user_companies(auth.uid()) AS uc
    WHERE uc.role IN ('admin','controller')
  )
)
WITH CHECK (
  company_id IN (
    SELECT uc.company_id FROM public.get_user_companies(auth.uid()) AS uc
    WHERE uc.role IN ('admin','controller')
  )
);

CREATE POLICY "pin_emp_tc_pm_manage"
ON public.pin_employee_timecard_settings FOR ALL
USING (public.has_role(auth.uid(), 'project_manager'))
WITH CHECK (public.has_role(auth.uid(), 'project_manager'));

CREATE POLICY "pin_emp_tc_company_view"
ON public.pin_employee_timecard_settings FOR SELECT
USING (
  company_id IN (
    SELECT uc.company_id FROM public.get_user_companies(auth.uid()) AS uc
  )
);

-- Trigger to maintain updated_at
DROP TRIGGER IF EXISTS update_pin_employee_timecard_settings_updated_at ON public.pin_employee_timecard_settings;
CREATE TRIGGER update_pin_employee_timecard_settings_updated_at
BEFORE UPDATE ON public.pin_employee_timecard_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();