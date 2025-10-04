-- Create trigger to automatically create time cards from punch records
CREATE TRIGGER create_time_card_on_punch_out
  AFTER INSERT OR UPDATE ON public.punch_records
  FOR EACH ROW
  EXECUTE FUNCTION public.create_time_card_from_punch();