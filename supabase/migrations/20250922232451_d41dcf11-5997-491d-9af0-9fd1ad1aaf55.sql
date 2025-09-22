-- Create employee timecard settings table
CREATE TABLE public.employee_timecard_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL,
  assigned_jobs UUID[] DEFAULT '{}',
  assigned_cost_codes UUID[] DEFAULT '{}',
  default_job_id UUID,
  default_cost_code_id UUID,
  require_location BOOLEAN DEFAULT true,
  require_photo BOOLEAN DEFAULT true,
  auto_lunch_deduction BOOLEAN DEFAULT true,
  lunch_duration_minutes INTEGER DEFAULT 30,
  max_daily_hours NUMERIC DEFAULT 12,
  overtime_threshold NUMERIC DEFAULT 8,
  allow_early_punch_in_minutes INTEGER DEFAULT 15,
  allow_late_punch_out_minutes INTEGER DEFAULT 15,
  notification_preferences JSONB DEFAULT '{"punch_reminders": true, "overtime_alerts": true, "missed_punch_alerts": true}',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.employee_timecard_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins and controllers can manage employee timecard settings"
ON public.employee_timecard_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

CREATE POLICY "Users can view their own timecard settings"
ON public.employee_timecard_settings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create role default pages table
CREATE TABLE public.role_default_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role user_role NOT NULL UNIQUE,
  default_page TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.role_default_pages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage role default pages"
ON public.role_default_pages
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "All users can view role default pages"
ON public.role_default_pages
FOR SELECT
TO authenticated
USING (true);

-- Insert default role pages with a placeholder UUID that will be updated
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Get an admin user ID or use a placeholder
  SELECT user_id INTO admin_user_id FROM profiles WHERE role = 'admin' LIMIT 1;
  
  -- If no admin found, use a random UUID as placeholder
  IF admin_user_id IS NULL THEN
    admin_user_id := gen_random_uuid();
  END IF;
  
  -- Insert default role pages
  INSERT INTO public.role_default_pages (role, default_page, created_by) VALUES
  ('admin', '/dashboard', admin_user_id),
  ('controller', '/dashboard', admin_user_id),
  ('project_manager', '/jobs', admin_user_id),
  ('employee', '/time-tracking', admin_user_id),
  ('view_only', '/dashboard', admin_user_id);
END $$;