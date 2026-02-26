
-- Create the punch_clock_attempt_audit table for logging geofence-blocked attempts
CREATE TABLE public.punch_clock_attempt_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  pin_employee_id UUID,
  company_id UUID,
  job_id UUID,
  action TEXT NOT NULL, -- 'in' or 'out'
  block_reason TEXT NOT NULL, -- 'OUT_OF_GEOFENCE_RANGE', 'JOB_LOCATION_MISSING', 'LOCATION_REQUIRED'
  distance_from_job_meters NUMERIC,
  distance_limit_meters INTEGER,
  device_latitude NUMERIC,
  device_longitude NUMERIC,
  job_latitude NUMERIC,
  job_longitude NUMERIC,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.punch_clock_attempt_audit ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (edge function uses service role key)
-- Admins/controllers can read audit logs for their company
CREATE POLICY "Company admins can view audit logs"
  ON public.punch_clock_attempt_audit
  FOR SELECT
  USING (
    public.is_company_admin_or_controller(auth.uid(), company_id)
  );

-- Create index for fast lookups
CREATE INDEX idx_punch_clock_attempt_audit_company ON public.punch_clock_attempt_audit (company_id, created_at DESC);
CREATE INDEX idx_punch_clock_attempt_audit_user ON public.punch_clock_attempt_audit (user_id, created_at DESC);
