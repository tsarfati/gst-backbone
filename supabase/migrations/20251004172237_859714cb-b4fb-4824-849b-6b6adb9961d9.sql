-- Update RLS policy to allow public read access to visitor logs
DROP POLICY IF EXISTS "Users can view visitor logs for their companies" ON public.visitor_logs;

CREATE POLICY "Anyone can view visitor logs" 
ON public.visitor_logs 
FOR SELECT 
USING (true);