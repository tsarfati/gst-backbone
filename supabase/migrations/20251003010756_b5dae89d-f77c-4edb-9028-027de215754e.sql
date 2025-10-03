-- Add proposed change columns to time_card_change_requests for detailed employee submissions
ALTER TABLE public.time_card_change_requests
ADD COLUMN IF NOT EXISTS proposed_punch_in_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS proposed_punch_out_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS proposed_job_id UUID,
ADD COLUMN IF NOT EXISTS proposed_cost_code_id UUID;

-- Optional: index to speed up approvals by time card
CREATE INDEX IF NOT EXISTS idx_tccr_time_card_id ON public.time_card_change_requests(time_card_id);
