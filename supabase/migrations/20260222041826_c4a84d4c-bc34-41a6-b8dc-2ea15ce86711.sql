
-- Create demo requests table
CREATE TABLE public.demo_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  number_of_users TEXT,
  industry TEXT,
  details TEXT,
  product TEXT DEFAULT 'punch-clock-lynk',
  status TEXT DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.demo_requests ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public form)
CREATE POLICY "Anyone can submit a demo request"
ON public.demo_requests
FOR INSERT
WITH CHECK (true);

-- Only authenticated admins can view
CREATE POLICY "Authenticated users can view demo requests"
ON public.demo_requests
FOR SELECT
USING (auth.uid() IS NOT NULL);
