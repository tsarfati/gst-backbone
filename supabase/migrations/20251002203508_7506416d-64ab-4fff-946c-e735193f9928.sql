-- Add company_policies field to job_punch_clock_settings
ALTER TABLE public.job_punch_clock_settings 
ADD COLUMN IF NOT EXISTS company_policies text;

-- Add time_card_change_requests table
CREATE TABLE IF NOT EXISTS public.time_card_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_card_id uuid NOT NULL REFERENCES public.time_cards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  review_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.time_card_change_requests ENABLE ROW LEVEL SECURITY;

-- Policies for time_card_change_requests
CREATE POLICY "Users can view their own change requests"
  ON public.time_card_change_requests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own change requests"
  ON public.time_card_change_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Managers can view all change requests"
  ON public.time_card_change_requests
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::user_role) OR 
    has_role(auth.uid(), 'controller'::user_role) OR 
    has_role(auth.uid(), 'project_manager'::user_role)
  );

CREATE POLICY "Managers can update change requests"
  ON public.time_card_change_requests
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::user_role) OR 
    has_role(auth.uid(), 'controller'::user_role) OR 
    has_role(auth.uid(), 'project_manager'::user_role)
  );

-- Add trigger for updated_at
CREATE TRIGGER update_time_card_change_requests_updated_at
  BEFORE UPDATE ON public.time_card_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();