-- Add criterion type support for RFP bid scoring.
ALTER TABLE public.bid_scoring_criteria
ADD COLUMN IF NOT EXISTS criterion_type TEXT NOT NULL DEFAULT 'numeric';

ALTER TABLE public.bid_scoring_criteria
ADD COLUMN IF NOT EXISTS criterion_options JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bid_scoring_criteria_criterion_type_check'
  ) THEN
    ALTER TABLE public.bid_scoring_criteria
      ADD CONSTRAINT bid_scoring_criteria_criterion_type_check
      CHECK (criterion_type IN ('numeric', 'yes_no', 'picklist'));
  END IF;
END $$;

