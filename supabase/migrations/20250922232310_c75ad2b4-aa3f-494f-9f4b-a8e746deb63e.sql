-- Create employee timecard settings table
CREATE TABLE IF NOT EXISTS public.employee_timecard_settings (
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
DROP POLICY IF EXISTS "Admins and controllers can manage employee timecard settings" ON public.employee_timecard_settings;
CREATE POLICY "Admins and controllers can manage employee timecard settings"
ON public.employee_timecard_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

DROP POLICY IF EXISTS "Users can view their own timecard settings" ON public.employee_timecard_settings;
CREATE POLICY "Users can view their own timecard settings"
ON public.employee_timecard_settings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create role default pages table
CREATE TABLE IF NOT EXISTS public.role_default_pages (
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
DROP POLICY IF EXISTS "Admins can manage role default pages" ON public.role_default_pages;
CREATE POLICY "Admins can manage role default pages"
ON public.role_default_pages
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

DROP POLICY IF EXISTS "All users can view role default pages" ON public.role_default_pages;
CREATE POLICY "All users can view role default pages"
ON public.role_default_pages
FOR SELECT
TO authenticated
USING (true);

-- Insert default role pages
WITH seed_actor AS (
  SELECT COALESCE(
    (SELECT user_id FROM public.profiles WHERE role = 'admin' LIMIT 1),
    '00000000-0000-0000-0000-000000000000'::uuid
  ) AS user_id
)
INSERT INTO public.role_default_pages (role, default_page, created_by)
SELECT role, default_page, seed_actor.user_id
FROM seed_actor
CROSS JOIN (
  VALUES
    ('admin'::user_role, '/dashboard'::text),
    ('controller'::user_role, '/dashboard'::text),
    ('project_manager'::user_role, '/jobs'::text),
    ('employee'::user_role, '/time-tracking'::text),
    ('view_only'::user_role, '/dashboard'::text)
) AS defaults(role, default_page)
ON CONFLICT (role) DO NOTHING;

-- Create storage bucket for punch photos if it doesn't exist
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES ('punch-photos', 'punch-photos', false, ARRAY['image/jpeg', 'image/png', 'image/webp'], 10485760)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for punch photos
DROP POLICY IF EXISTS "Users can upload their own punch photos" ON storage.objects;
CREATE POLICY "Users can upload their own punch photos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'punch-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Users can view their own punch photos" ON storage.objects;
CREATE POLICY "Users can view their own punch photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'punch-photos' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

DROP POLICY IF EXISTS "Admins can view all punch photos" ON storage.objects;
CREATE POLICY "Admins can view all punch photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'punch-photos' AND
  (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
);
