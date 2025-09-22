-- Create time_cards table for storing approved time entries
CREATE TABLE public.time_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  job_id UUID,
  cost_code_id UUID,
  punch_in_time TIMESTAMP WITH TIME ZONE NOT NULL,
  punch_out_time TIMESTAMP WITH TIME ZONE NOT NULL,
  total_hours NUMERIC NOT NULL,
  overtime_hours NUMERIC DEFAULT 0,
  break_minutes INTEGER DEFAULT 0,
  punch_in_location_lat NUMERIC,
  punch_in_location_lng NUMERIC,
  punch_out_location_lat NUMERIC,
  punch_out_location_lng NUMERIC,
  punch_in_photo_url TEXT,
  punch_out_photo_url TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'approved', -- approved, corrected
  is_correction BOOLEAN DEFAULT FALSE,
  original_time_card_id UUID,
  correction_reason TEXT,
  correction_requested_at TIMESTAMP WITH TIME ZONE,
  correction_approved_at TIMESTAMP WITH TIME ZONE,
  correction_approved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create punch_clock_settings table for company-wide settings
CREATE TABLE public.punch_clock_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  require_location BOOLEAN DEFAULT TRUE,
  require_photo BOOLEAN DEFAULT TRUE,
  allow_manual_entry BOOLEAN DEFAULT FALSE,
  auto_break_duration INTEGER DEFAULT 30, -- minutes
  overtime_threshold NUMERIC DEFAULT 8, -- hours per day
  location_accuracy_meters INTEGER DEFAULT 100,
  photo_required_for_corrections BOOLEAN DEFAULT TRUE,
  notification_enabled BOOLEAN DEFAULT TRUE,
  manager_approval_required BOOLEAN DEFAULT FALSE,
  grace_period_minutes INTEGER DEFAULT 5,
  break_reminder_minutes INTEGER DEFAULT 240, -- 4 hours
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Create time_card_corrections table for tracking correction requests
CREATE TABLE public.time_card_corrections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time_card_id UUID NOT NULL,
  requested_by UUID NOT NULL,
  correction_type TEXT NOT NULL, -- 'time_adjustment', 'job_change', 'cost_code_change', 'other'
  original_punch_in TIMESTAMP WITH TIME ZONE,
  original_punch_out TIMESTAMP WITH TIME ZONE,
  requested_punch_in TIMESTAMP WITH TIME ZONE,
  requested_punch_out TIMESTAMP WITH TIME ZONE,
  original_job_id UUID,
  requested_job_id UUID,
  original_cost_code_id UUID,
  requested_cost_code_id UUID,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.time_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punch_clock_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_card_corrections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for time_cards
CREATE POLICY "Users can view their own time cards"
ON public.time_cards
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins and controllers can view all time cards"
ON public.time_cards
FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controller'));

CREATE POLICY "Users can create their own time cards"
ON public.time_cards
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and controllers can manage time cards"
ON public.time_cards
FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controller'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controller'));

-- Create RLS policies for punch_clock_settings
CREATE POLICY "Users can view punch clock settings for their company"
ON public.punch_clock_settings
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and controllers can manage punch clock settings"
ON public.punch_clock_settings
FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controller'))
WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controller'));

-- Create RLS policies for time_card_corrections
CREATE POLICY "Users can view their own correction requests"
ON public.time_card_corrections
FOR SELECT
USING (auth.uid() = requested_by);

CREATE POLICY "Admins and controllers can view all correction requests"
ON public.time_card_corrections
FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controller'));

CREATE POLICY "Users can create correction requests for their time cards"
ON public.time_card_corrections
FOR INSERT
WITH CHECK (
  auth.uid() = requested_by AND
  EXISTS (
    SELECT 1 FROM public.time_cards 
    WHERE id = time_card_corrections.time_card_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Admins and controllers can manage correction requests"
ON public.time_card_corrections
FOR UPDATE
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'controller'));

-- Create function to automatically create time cards from completed punch cycles
CREATE OR REPLACE FUNCTION public.create_time_card_from_punch()
RETURNS TRIGGER AS $$
DECLARE
  punch_in_record RECORD;
  total_hours_calc NUMERIC;
  overtime_calc NUMERIC;
  break_deduction INTEGER := 0;
BEGIN
  -- Only process when punch_out occurs (punch_type = 'out')
  IF NEW.punch_type = 'out' THEN
    -- Find the corresponding punch_in record
    SELECT * INTO punch_in_record
    FROM public.punch_records
    WHERE user_id = NEW.user_id
    AND punch_type = 'in'
    AND job_id = NEW.job_id
    AND cost_code_id = NEW.cost_code_id
    AND punch_time < NEW.punch_time
    ORDER BY punch_time DESC
    LIMIT 1;
    
    IF punch_in_record IS NOT NULL THEN
      -- Calculate total hours
      total_hours_calc := EXTRACT(EPOCH FROM (NEW.punch_time - punch_in_record.punch_time)) / 3600;
      
      -- Apply automatic break deduction for shifts over 6 hours
      IF total_hours_calc > 6 THEN
        break_deduction := 30; -- 30 minute break
        total_hours_calc := total_hours_calc - 0.5;
      END IF;
      
      -- Calculate overtime (hours over 8 per day)
      overtime_calc := GREATEST(0, total_hours_calc - 8);
      
      -- Create time card entry
      INSERT INTO public.time_cards (
        user_id,
        job_id,
        cost_code_id,
        punch_in_time,
        punch_out_time,
        total_hours,
        overtime_hours,
        break_minutes,
        punch_in_location_lat,
        punch_in_location_lng,
        punch_out_location_lat,
        punch_out_location_lng,
        punch_in_photo_url,
        punch_out_photo_url,
        notes,
        status
      ) VALUES (
        NEW.user_id,
        NEW.job_id,
        NEW.cost_code_id,
        punch_in_record.punch_time,
        NEW.punch_time,
        total_hours_calc,
        overtime_calc,
        break_deduction,
        punch_in_record.latitude,
        punch_in_record.longitude,
        NEW.latitude,
        NEW.longitude,
        punch_in_record.photo_url,
        NEW.photo_url,
        NEW.notes,
        'approved' -- Automatically approved as per requirements
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create time cards
CREATE TRIGGER create_time_card_trigger
AFTER INSERT ON public.punch_records
FOR EACH ROW
EXECUTE FUNCTION public.create_time_card_from_punch();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_time_card_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_time_cards_updated_at
BEFORE UPDATE ON public.time_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_time_card_updated_at();

CREATE TRIGGER update_punch_clock_settings_updated_at
BEFORE UPDATE ON public.punch_clock_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_time_card_updated_at();

CREATE TRIGGER update_time_card_corrections_updated_at
BEFORE UPDATE ON public.time_card_corrections
FOR EACH ROW
EXECUTE FUNCTION public.update_time_card_updated_at();