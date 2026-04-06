ALTER TABLE public.punch_records
ADD COLUMN IF NOT EXISTS accuracy_meters numeric(10,2);

ALTER TABLE public.current_punch_status
ADD COLUMN IF NOT EXISTS punch_in_accuracy_meters numeric(10,2);

ALTER TABLE public.time_cards
ADD COLUMN IF NOT EXISTS punch_in_accuracy_meters numeric(10,2),
ADD COLUMN IF NOT EXISTS punch_out_accuracy_meters numeric(10,2),
ADD COLUMN IF NOT EXISTS low_location_confidence boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.punch_records.accuracy_meters IS 'Reported device GPS accuracy in meters at punch time.';
COMMENT ON COLUMN public.current_punch_status.punch_in_accuracy_meters IS 'Reported device GPS accuracy in meters at punch in.';
COMMENT ON COLUMN public.time_cards.punch_in_accuracy_meters IS 'Reported device GPS accuracy in meters at punch in.';
COMMENT ON COLUMN public.time_cards.punch_out_accuracy_meters IS 'Reported device GPS accuracy in meters at punch out.';
COMMENT ON COLUMN public.time_cards.low_location_confidence IS 'True when one or both punch locations had weak GPS confidence and should be highlighted in review.';
