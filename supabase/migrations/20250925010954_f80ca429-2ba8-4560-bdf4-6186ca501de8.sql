-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS create_time_card_trigger ON punch_records;

-- Recreate the trigger function and trigger
CREATE TRIGGER create_time_card_trigger
  AFTER INSERT ON public.punch_records
  FOR EACH ROW
  EXECUTE FUNCTION public.create_time_card_from_punch();