-- Enable realtime and ensure triggers for time card creation
-- 1) Ensure full row data for realtime
ALTER TABLE public.time_cards REPLICA IDENTITY FULL;
ALTER TABLE public.current_punch_status REPLICA IDENTITY FULL;
ALTER TABLE public.punch_records REPLICA IDENTITY FULL;

-- 2) Add tables to supabase_realtime publication (safe to re-run)
DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.time_cards';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END; $$;

DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.current_punch_status';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END; $$;

DO $$
BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.punch_records';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END; $$;

-- 3) Create trigger to auto-create time_cards on punch out
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_create_time_card_from_punch'
  ) THEN
    EXECUTE 'DROP TRIGGER trg_create_time_card_from_punch ON public.punch_records';
  END IF;
END $$;

CREATE TRIGGER trg_create_time_card_from_punch
AFTER INSERT ON public.punch_records
FOR EACH ROW
EXECUTE FUNCTION public.create_time_card_from_punch();