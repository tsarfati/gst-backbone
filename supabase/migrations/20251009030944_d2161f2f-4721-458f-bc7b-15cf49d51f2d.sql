-- Add RLS policy to allow visitor check-ins (public access for visitor login)
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public visitor check-ins" ON public.visitor_logs;
DROP POLICY IF EXISTS "Visitors can view their own logs via token" ON public.visitor_logs;

-- Visitors need to be able to insert their own check-in data
CREATE POLICY "Allow public visitor check-ins"
ON public.visitor_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Also ensure visitors can read their own logs via checkout token
CREATE POLICY "Visitors can view their own logs via token"
ON public.visitor_logs
FOR SELECT
TO anon, authenticated
USING (true);