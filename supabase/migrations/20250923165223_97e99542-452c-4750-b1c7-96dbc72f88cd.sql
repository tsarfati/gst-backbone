-- Add fields to time_cards table for approval logic and location warnings
ALTER TABLE public.time_cards 
ADD COLUMN IF NOT EXISTS distance_warning boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS distance_from_job_meters numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS requires_approval boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) DEFAULT NULL;

-- Add fields to punch_clock_settings table for distance-based warnings
ALTER TABLE public.punch_clock_settings 
ADD COLUMN IF NOT EXISTS enable_distance_warnings boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS max_distance_from_job_meters integer DEFAULT 200;

-- Add fields to jobs table for location coordinates
ALTER TABLE public.jobs 
ADD COLUMN IF NOT EXISTS latitude numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS longitude numeric DEFAULT NULL;

-- Update time_cards that were created via punch clock to not require approval if no corrections
UPDATE public.time_cards 
SET requires_approval = false 
WHERE created_via_punch_clock = true 
  AND correction_reason IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_time_cards_requires_approval ON public.time_cards(requires_approval);
CREATE INDEX IF NOT EXISTS idx_time_cards_user_punch_time ON public.time_cards(user_id, punch_in_time);