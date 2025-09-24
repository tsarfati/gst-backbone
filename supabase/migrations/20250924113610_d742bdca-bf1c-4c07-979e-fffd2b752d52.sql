-- Enable real-time for punch-related tables
ALTER TABLE public.current_punch_status REPLICA IDENTITY FULL;
ALTER TABLE public.punch_records REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.current_punch_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.punch_records;