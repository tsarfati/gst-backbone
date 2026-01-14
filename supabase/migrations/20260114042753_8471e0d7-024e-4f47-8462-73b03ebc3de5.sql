-- Create a table for user report favorites
CREATE TABLE public.user_report_favorites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL,
  report_key TEXT NOT NULL,
  report_category TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id, report_key)
);

-- Enable Row Level Security
ALTER TABLE public.user_report_favorites ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own report favorites" 
ON public.user_report_favorites 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own report favorites" 
ON public.user_report_favorites 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own report favorites" 
ON public.user_report_favorites 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_user_report_favorites_lookup ON public.user_report_favorites(user_id, company_id);