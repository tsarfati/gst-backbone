-- Create job_punch_clock_settings table for job-specific overrides
CREATE TABLE public.job_punch_clock_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    company_id UUID NOT NULL,
    
    -- Time window settings that override general settings
    punch_time_window_start TIME,
    punch_time_window_end TIME,
    earliest_punch_start_time TIME,
    latest_punch_in_time TIME,
    
    -- Punch rounding settings
    enable_punch_rounding BOOLEAN DEFAULT false,
    punch_rounding_minutes INTEGER DEFAULT 15,
    punch_rounding_direction TEXT DEFAULT 'nearest' CHECK (punch_rounding_direction IN ('up', 'down', 'nearest')),
    
    -- Location and photo requirements
    require_location BOOLEAN DEFAULT true,
    require_photo BOOLEAN DEFAULT true,
    location_accuracy_meters INTEGER DEFAULT 100,
    
    -- Break and overtime settings
    auto_break_duration INTEGER DEFAULT 30,
    auto_break_wait_hours NUMERIC(4,2) DEFAULT 6,
    overtime_threshold NUMERIC(4,2) DEFAULT 8,
    calculate_overtime BOOLEAN DEFAULT true,
    
    -- Grace period and notifications
    grace_period_minutes INTEGER DEFAULT 5,
    notification_enabled BOOLEAN DEFAULT true,
    
    -- Management settings
    manager_approval_required BOOLEAN DEFAULT false,
    allow_manual_entry BOOLEAN DEFAULT false,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID NOT NULL,
    
    -- Unique constraint
    UNIQUE(job_id)
);

-- Enable RLS
ALTER TABLE public.job_punch_clock_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins and controllers can manage job punch clock settings" 
ON public.job_punch_clock_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'controller'::user_role));

CREATE POLICY "Users can view job punch clock settings for their company" 
ON public.job_punch_clock_settings 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_job_punch_clock_settings_updated_at
BEFORE UPDATE ON public.job_punch_clock_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();