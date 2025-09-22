-- Add new columns to punch_clock_settings for enhanced functionality
ALTER TABLE public.punch_clock_settings ADD COLUMN IF NOT EXISTS punch_time_window_start TIME DEFAULT '06:00:00';
ALTER TABLE public.punch_clock_settings ADD COLUMN IF NOT EXISTS punch_time_window_end TIME DEFAULT '22:00:00';
ALTER TABLE public.punch_clock_settings ADD COLUMN IF NOT EXISTS enable_punch_rounding BOOLEAN DEFAULT FALSE;
ALTER TABLE public.punch_clock_settings ADD COLUMN IF NOT EXISTS punch_rounding_minutes INTEGER DEFAULT 15;
ALTER TABLE public.punch_clock_settings ADD COLUMN IF NOT EXISTS punch_rounding_direction TEXT DEFAULT 'nearest' CHECK (punch_rounding_direction IN ('up', 'down', 'nearest'));
ALTER TABLE public.punch_clock_settings ADD COLUMN IF NOT EXISTS auto_break_wait_hours NUMERIC DEFAULT 6;
ALTER TABLE public.punch_clock_settings ADD COLUMN IF NOT EXISTS calculate_overtime BOOLEAN DEFAULT TRUE;

-- Update the existing triggers to include updated_at
CREATE OR REPLACE TRIGGER update_punch_clock_settings_updated_at
    BEFORE UPDATE ON public.punch_clock_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();